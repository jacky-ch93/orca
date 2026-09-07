import type { AiVaultHistoryReadResult } from '../../shared/ai-vault-history-types'
import type { AiVaultAgent, AiVaultSession } from '../../shared/ai-vault-types'
import {
  isConversationKnowledgeItemFresh,
  type ConversationKnowledgeIndexStatus,
  type ConversationKnowledgeItem
} from '../../shared/conversation-knowledge-items'
import type { TuiAgent } from '../../shared/tui-agent'
import { resolveConversationKnowledgeModel, type enrichAiVaultSession } from './session-enrichment'

const MAX_CONCURRENT_SUMMARIES = 2

type KnowledgeStore = {
  list(): Promise<ConversationKnowledgeItem[]>
  upsert(item: ConversationKnowledgeItem): Promise<void>
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

  constructor(private readonly dependencies: ConversationKnowledgeServiceDependencies) {}

  async generate(args: GenerateConversationKnowledgeArgs): Promise<ConversationKnowledgeItem> {
    const sessions = await this.dependencies.listSessions()
    const session = sessions.find(
      (candidate) => candidate.agent === args.sourceAgent && candidate.sessionId === args.sessionId
    )
    if (!session) {
      throw new Error('Source conversation was not found on this execution host.')
    }
    return this.generateFromSession(session, args)
  }

  async startIndex(args: {
    generatorAgent: TuiAgent
    generatorModel: string
    scopePaths?: string[]
    force?: boolean
    language?: string
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
      await this.indexPromise
      return this.startIndex(args)
    }
    const [sessions, existingItems] = await Promise.all([
      this.dependencies.listSessions(),
      this.dependencies.store.list()
    ])
    const scopedSessions = sessions.filter((session) => {
      const cwd = session.cwd
      return (
        !args.scopePaths?.length ||
        (cwd !== null && args.scopePaths.some((scopePath) => pathContains(scopePath, cwd)))
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
        !isConversationKnowledgeItemFresh(existing, {
          sourceUpdatedAt: session.updatedAt,
          generatorAgent: args.generatorAgent,
          generatorModel: resolveConversationKnowledgeModel(
            args.generatorAgent,
            args.generatorModel
          )
        })
      )
    })
    this.indexStatus = {
      state: pendingSessions.length ? 'running' : 'idle',
      total: pendingSessions.length,
      completed: 0,
      failed: 0
    }
    if (pendingSessions.length) {
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

  private async runIndex(
    sessions: readonly AiVaultSession[],
    args: { generatorAgent: TuiAgent; generatorModel: string; language?: string }
  ): Promise<void> {
    let nextIndex = 0
    const worker = async (): Promise<void> => {
      while (nextIndex < sessions.length) {
        const session = sessions[nextIndex++]
        try {
          await this.generateFromSession(session, {
            sourceAgent: session.agent,
            sessionId: session.sessionId,
            generatorAgent: args.generatorAgent,
            generatorModel: args.generatorModel,
            language: args.language
          })
          this.indexStatus = { ...this.indexStatus, completed: this.indexStatus.completed + 1 }
        } catch {
          this.indexStatus = { ...this.indexStatus, failed: this.indexStatus.failed + 1 }
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
  ): Promise<ConversationKnowledgeItem> {
    const history = await this.dependencies.readSession({
      agent: args.sourceAgent,
      sessionId: args.sessionId
    })
    const enrichment = await this.dependencies.enrich({
      session,
      messages: history.messages,
      agent: args.generatorAgent,
      model: args.generatorModel,
      language: args.language
    })
    const knowledgeTitle = resolveKnowledgeTitle(
      enrichment.title,
      session.title,
      enrichment.summary,
      history.messages
    )
    const item: ConversationKnowledgeItem = {
      id: `${session.executionHostId}:${session.agent}:${session.sessionId}`,
      source: {
        executionHostId: session.executionHostId,
        agent: session.agent,
        sessionId: session.sessionId,
        title: session.title,
        cwd: session.cwd,
        updatedAt: session.updatedAt
      },
      knowledge: {
        title: knowledgeTitle,
        summary: enrichment.summary,
        topics: enrichment.topics,
        conclusions: enrichment.conclusions,
        entities: enrichment.entities
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
    const items = await this.dependencies.store.list()
    if (!scopePaths?.length) {
      return items
    }
    return items.filter(
      (item) =>
        item.source.cwd !== null && scopePaths.some((path) => pathContains(path, item.source.cwd!))
    )
  }
}

function pathContains(scopePath: string, candidatePath: string): boolean {
  const scope = scopePath.replaceAll('\\', '/').replace(/\/+$/, '').toLocaleLowerCase()
  const candidate = candidatePath.replaceAll('\\', '/').replace(/\/+$/, '').toLocaleLowerCase()
  return candidate === scope || candidate.startsWith(`${scope}/`)
}

function deriveKnowledgeTitle(sourceTitle: string, summary: string): string {
  const normalized = sourceTitle.trim()
  if (isSpecificKnowledgeTitle(normalized)) {
    return normalized
  }
  const sentence = summary
    .trim()
    .split(/(?<=[.!?。！？])\s+/u)[0]
    ?.trim()
  return (sentence || 'Conversation knowledge').slice(0, 120)
}

function resolveKnowledgeTitle(
  generatedTitle: string | undefined,
  sourceTitle: string,
  summary: string,
  messages: readonly { role: string; text: string }[]
): string {
  if (generatedTitle && isSpecificKnowledgeTitle(generatedTitle)) {
    return generatedTitle.slice(0, 120)
  }
  const userMessage = messages.find((message) => message.role === 'user')?.text.trim()
  const firstLine = userMessage?.split(/\r?\n/u)[0]?.trim()
  if (firstLine && isSpecificKnowledgeTitle(firstLine)) {
    return firstLine.slice(0, 120)
  }
  return deriveKnowledgeTitle(sourceTitle, summary)
}

function isSpecificKnowledgeTitle(value: string): boolean {
  return value.length > 0 && value.length <= 120 && !isGenericKnowledgeTitle(value)
}

function isGenericKnowledgeTitle(value: string): boolean {
  return /^(?:you are an information curator|summarize the conversation|short descriptive title|conversation knowledge)/i.test(
    value.trim()
  )
}
