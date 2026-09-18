import type { AiVaultAgent } from './ai-vault-types'
import type { ExecutionHostId } from './execution-host'
import type { TuiAgent } from './tui-agent'
import { reconcileConversationKnowledgeConflicts } from './conversation-knowledge-conflicts'

export type ConversationKnowledgeItem = {
  id: string
  source: {
    executionHostId: ExecutionHostId
    agent: AiVaultAgent
    sessionId: string
    title: string
    cwd: string | null
    createdAt?: string | null
    updatedAt: string | null
    modifiedAt?: string
  }
  knowledge: {
    title?: string
    summary: string
    topics: string[]
    conclusions: string[]
    entities: string[]
    searchTerms?: string[]
    handoff?: ConversationKnowledgeHandoffEntry[]
  }
  generator: {
    agent: TuiAgent
    model: string
    generatedAt: string
  }
}

export type ConversationKnowledgeHandoffEntry = {
  kind: 'decision' | 'constraint' | 'progress' | 'open-loop'
  text: string
  reliability: 'user-confirmed' | 'verified' | 'inferred' | 'proposal'
  evidence: {
    kind: 'conversation' | 'tool-result'
    messageId: string
  }
  lifecycle?: {
    status: 'active' | 'superseded' | 'conflicted' | 'expired'
    reason?: 'automatic-conflict'
  }
  claim?: {
    subject: string
    relation: string
    object: string
    cardinality: 'single'
  }
}

export type ConversationKnowledgeListResult = {
  items: ConversationKnowledgeItem[]
}

export type GenerateConversationKnowledgeRequest = {
  sourceAgent: AiVaultAgent
  sessionId: string
  generatorAgent: TuiAgent
  generatorModel?: string | null
  language?: string
}

export type StartConversationKnowledgeIndexRequest = {
  generatorAgent: TuiAgent
  generatorModel: string
  scopePaths?: string[]
  force?: boolean
  language?: string
}

export type ConversationKnowledgeIndexStatus = {
  state: 'idle' | 'running'
  total: number
  completed: number
  failed: number
}

export function isConversationKnowledgeGenerationTitle(title: string): boolean {
  return /^(?:you are an information curator for a developer workspace|summarize the conversation below as strict json)/i.test(
    title.trim()
  )
}

export function searchConversationKnowledgeItems(
  items: readonly ConversationKnowledgeItem[],
  query: string
): ConversationKnowledgeItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return [...items]
  }
  return items.filter((item) => conversationKnowledgeSearchText(item).includes(normalizedQuery))
}

export function isConversationKnowledgeItemFresh(
  item: ConversationKnowledgeItem,
  expected: {
    sourceUpdatedAt: string | null
    generatorAgent: TuiAgent
    generatorModel: string
  }
): boolean {
  return (
    item.source.updatedAt === expected.sourceUpdatedAt &&
    item.generator.agent === expected.generatorAgent &&
    item.generator.model === expected.generatorModel
  )
}

export function conversationKnowledgeSearchText(item: ConversationKnowledgeItem): string {
  return [
    item.source.title,
    item.knowledge.summary,
    ...item.knowledge.topics,
    ...item.knowledge.conclusions,
    ...item.knowledge.entities,
    ...(item.knowledge.searchTerms ?? []),
    ...(item.knowledge.handoff ?? []).flatMap((entry) => [
      entry.text,
      entry.claim?.subject ?? '',
      entry.claim?.relation ?? '',
      entry.claim?.object ?? ''
    ])
  ]
    .join('\n')
    .toLocaleLowerCase()
}

export function buildConversationKnowledgeContextPack(args: {
  items: readonly ConversationKnowledgeItem[]
  cwd: string
}): string {
  const entries = reconcileConversationKnowledgeConflicts(args.items)
    .filter((item) => item.source.cwd === args.cwd)
    .flatMap((item) =>
      (item.knowledge.handoff ?? [])
        .filter((entry) => entry.reliability === 'user-confirmed')
        .filter(
          (entry) => entry.lifecycle?.status === undefined || entry.lifecycle.status === 'active'
        )
        .map((entry) => ({ entry, sessionId: item.source.sessionId }))
    )
    .slice(0, 8)
  if (!entries.length) {
    return ''
  }
  return [
    'Historical work context (source-backed; use only when relevant):',
    ...entries.map(({ entry, sessionId }) => `- ${entry.kind}: ${entry.text} [${sessionId}]`)
  ].join('\n')
}
