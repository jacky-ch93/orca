import type { AiVaultHistoryReadResult } from '../../shared/ai-vault-history-types'
import {
  isAiVaultSessionResumableContent,
  type AiVaultAgent,
  type AiVaultSession
} from '../../shared/ai-vault-types'
import {
  isConversationKnowledgeItemFresh,
  type ConversationKnowledgeIndexStatus,
  type ConversationKnowledgeItem
} from '../../shared/conversation-knowledge-items'
import type { TuiAgent } from '../../shared/tui-agent'
import { resolveConversationKnowledgeModel, type enrichAiVaultSession } from './session-enrichment'
import {
  findVerifiedLegacyEmptyIds,
  readableConversationMessages
} from './conversation-knowledge-empty-detection'
import {
  conversationKnowledgeId,
  conversationPathIsWithin,
  isKnowledgeGenerationSession
} from './conversation-knowledge-source-session'
import { resolveKnowledgeTitle } from './conversation-knowledge-title'
import { conversationKnowledgeSource } from './conversation-knowledge-source'
import { cancelLocalGeneration } from '../text-generation/source-control-generation-lanes'
import { visibleConversationKnowledgeItems } from './conversation-knowledge-visible-items'

// Keep one active process so a model switch can cancel the exact in-flight call.
const MAX_CONCURRENT_SUMMARIES = 1

type KnowledgeStore = {
  list(): Promise<ConversationKnowledgeItem[]>
  upsert(item: ConversationKnowledgeItem): Promise<void>
  remove(ids: readonly string[]): Promise<void>
}

type ConversationKnowledgeServiceDependencies = {
  listSessions(): Promise<AiVaultSession[]>
  readSession(args: { agent: AiVaultAgent; sessionId: string }): Promise<AiVaultHistoryReadResult>
  enrich: typeof enrichAiVaultSession
  store: KnowledgeStore
}

export type GenerateConversationKnowledgeArgs = {
  sourceAgent: AiVaultAgent
  sessionId: string
  generatorAgent: TuiAgent
  generatorModel?: string | null
  language?: string
}

export class ConversationKnowledgeService {
  private indexStatus: ConversationKnowledgeIndexStatus = {
    state: 'idle',
    total: 0,
    completed: 0,
    failed: 0
  }
  private indexPromise: Promise<void> | null = null
  private indexConfig: string | null = null
  private cancelRequested = false
  private activeCwd: string | null = null

  constructor(private readonly dependencies: ConversationKnowledgeServiceDependencies) {}

  async generate(args: GenerateConversationKnowledgeArgs): Promise<ConversationKnowledgeItem> {
    const sessions = await this.dependencies.listSessions()
    const session = sessions.find(
      (candidate) => candidate.agent === args.sourceAgent && candidate.sessionId === args.sessionId
    )
    if (!session) {
      throw new Error('Source conversation was not found on this execution host.')
    }
    const item = await this.generateFromSession(session, args)
    if (!item) {
      throw new Error('Source conversation has no readable user or assistant messages.')
    }
    return item
  }

  async startIndex(args: {
    generatorAgent: TuiAgent
    generatorModel: string
    scopePaths?: string[]
    force?: boolean
    language?: string
    preserveExisting?: boolean
  }): Promise<ConversationKnowledgeIndexStatus> {
    const configKey = JSON.stringify({
      generatorAgent: args.generatorAgent,
      generatorModel: resolveConversationKnowledgeModel(args.generatorAgent, args.generatorModel),
      scopePaths: args.scopePaths ?? [],
      language: args.language ?? 'en'
    })
    if (this.indexPromise) {
      if (this.indexConfig === configKey) {
        return this.indexStatus
      }
      this.cancelIndex()
      await this.indexPromise
      // A model/agent switch resumes only sessions without a saved result;
      // completed summaries remain valid until explicitly regenerated.
      return this.startIndex({ ...args, preserveExisting: true })
    }
    const [sessions, existingItems] = await Promise.all([
      this.dependencies.listSessions(),
      this.dependencies.store.list()
    ])
    const sourceSessions = sessions.filter((session) => !isKnowledgeGenerationSession(session))
    await this.removeKnownEmptyItems(sourceSessions, existingItems)
    const scopedSessions = sourceSessions.filter((session) => {
      if (!isAiVaultSessionResumableContent(session)) {
        return false
      }
      const cwd = session.cwd
      return (
        !args.scopePaths?.length ||
        (cwd !== null &&
          args.scopePaths.some((scopePath) => conversationPathIsWithin(scopePath, cwd)))
      )
    })
    const pendingSessions = scopedSessions.filter((session) => {
      if (args.force) {
        return true
      }
      const existing = existingItems.find(
        (item) =>
          item.source.executionHostId === session.executionHostId &&
          item.source.agent === session.agent &&
          item.source.sessionId === session.sessionId
      )
      return (
        !existing ||
        (!args.preserveExisting &&
          !isConversationKnowledgeItemFresh(existing, {
            sourceUpdatedAt: session.updatedAt,
            generatorAgent: args.generatorAgent,
            generatorModel: resolveConversationKnowledgeModel(
              args.generatorAgent,
              args.generatorModel
            )
          }))
      )
    })
    this.indexStatus = {
      state: pendingSessions.length ? 'running' : 'idle',
      total: pendingSessions.length,
      completed: 0,
      failed: 0
    }
    if (pendingSessions.length) {
      this.cancelRequested = false
      this.indexConfig = configKey
      this.indexPromise = this.runIndex(pendingSessions, args).finally(() => {
        this.indexStatus = { ...this.indexStatus, state: 'idle' }
        this.indexPromise = null
        this.indexConfig = null
      })
    }
    return this.indexStatus
  }

  getIndexStatus(): ConversationKnowledgeIndexStatus {
    return this.indexStatus
  }

  cancelIndex(): void {
    this.cancelRequested = true
    this.indexStatus = {
      ...this.indexStatus,
      state: 'idle',
      failed: Math.max(this.indexStatus.failed, this.indexStatus.total - this.indexStatus.completed)
    }
    if (this.activeCwd) {
      cancelLocalGeneration('knowledge-enrichment', this.activeCwd)
    }
  }

  private async runIndex(
    sessions: readonly AiVaultSession[],
    args: { generatorAgent: TuiAgent; generatorModel: string; language?: string }
  ): Promise<void> {
    let nextIndex = 0
    const worker = async (): Promise<void> => {
      while (nextIndex < sessions.length) {
        if (this.cancelRequested) {
          return
        }
        const session = sessions[nextIndex++]
        this.activeCwd = session.cwd ?? process.cwd()
        try {
          await this.generateFromSession(session, {
            sourceAgent: session.agent,
            sessionId: session.sessionId,
            generatorAgent: args.generatorAgent,
            generatorModel: args.generatorModel,
            language: args.language
          })
          this.indexStatus = {
            ...this.indexStatus,
            completed: this.indexStatus.completed + 1
          }
        } catch (error) {
          if (!isCanceledGeneration(error)) {
            this.indexStatus = { ...this.indexStatus, failed: this.indexStatus.failed + 1 }
          }
        } finally {
          this.activeCwd = null
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT_SUMMARIES, sessions.length) }, () => worker())
    )
  }

  private async generateFromSession(
    session: AiVaultSession,
    args: GenerateConversationKnowledgeArgs
  ): Promise<ConversationKnowledgeItem | null> {
    const history = await this.dependencies.readSession({
      agent: args.sourceAgent,
      sessionId: args.sessionId
    })
    const readableMessages = readableConversationMessages(history.messages)
    if (readableMessages.length === 0) {
      await this.dependencies.store.remove([conversationKnowledgeId(session)])
      return null
    }
    const enrichment = await this.dependencies.enrich({
      session,
      messages: readableMessages,
      agent: args.generatorAgent,
      model: args.generatorModel,
      language: args.language
    })
    const knowledgeTitle = resolveKnowledgeTitle(
      enrichment.title,
      session.title,
      enrichment.summary,
      readableMessages
    )
    const item: ConversationKnowledgeItem = {
      id: `${session.executionHostId}:${session.agent}:${session.sessionId}`,
      source: conversationKnowledgeSource(session),
      knowledge: {
        title: knowledgeTitle,
        summary: enrichment.summary,
        topics: enrichment.topics,
        conclusions: enrichment.conclusions,
        entities: enrichment.entities,
        searchTerms: enrichment.searchTerms,
        handoff: enrichment.handoff
      },
      generator: {
        agent: args.generatorAgent,
        model: enrichment.model,
        generatedAt: new Date().toISOString()
      }
    }
    await this.dependencies.store.upsert(item)
    return item
  }

  async list(scopePaths?: readonly string[]): Promise<ConversationKnowledgeItem[]> {
    const [items, sessions] = await Promise.all([
      this.dependencies.store.list(),
      this.dependencies.listSessions()
    ])
    const sourceSessions = sessions.filter((session) => !isKnowledgeGenerationSession(session))
    const emptyIds = await this.removeKnownEmptyItems(sourceSessions, items)
    const legacyEmptyIds = await findVerifiedLegacyEmptyIds({
      sessions: sourceSessions,
      items,
      knownEmptyIds: emptyIds,
      readSession: this.dependencies.readSession
    })
    await this.dependencies.store.remove([...legacyEmptyIds])
    const visibleItems = visibleConversationKnowledgeItems({
      items,
      sourceSessions,
      emptyIds,
      legacyEmptyIds
    })
    if (!scopePaths?.length) {
      return visibleItems
    }
    return visibleItems.filter(
      (item) =>
        item.source.cwd !== null &&
        scopePaths.some((path) => conversationPathIsWithin(path, item.source.cwd!))
    )
  }

  private async removeKnownEmptyItems(
    sessions: readonly AiVaultSession[],
    items: readonly ConversationKnowledgeItem[]
  ): Promise<Set<string>> {
    const emptyIds = new Set(
      sessions
        .filter((session) => !isAiVaultSessionResumableContent(session))
        .map(conversationKnowledgeId)
    )
    const cachedEmptyIds = items.filter((item) => emptyIds.has(item.id)).map((item) => item.id)
    await this.dependencies.store.remove(cachedEmptyIds)
    return emptyIds
  }
}

function isCanceledGeneration(error: unknown): boolean {
  return error instanceof Error && /generation canceled/i.test(error.message)
}
