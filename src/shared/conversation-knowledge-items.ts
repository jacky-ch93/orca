import type { AiVaultAgent } from './ai-vault-types'
import type { ExecutionHostId } from './execution-host'
import type { TuiAgent } from './tui-agent'

export type ConversationKnowledgeItem = {
  id: string
  source: {
    executionHostId: ExecutionHostId
    agent: AiVaultAgent
    sessionId: string
    title: string
    cwd: string | null
    updatedAt: string | null
  }
  knowledge: {
    title?: string
    summary: string
    topics: string[]
    conclusions: string[]
    entities: string[]
  }
  generator: {
    agent: TuiAgent
    model: string
    generatedAt: string
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

export function searchConversationKnowledgeItems(
  items: readonly ConversationKnowledgeItem[],
  query: string
): ConversationKnowledgeItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return [...items]
  }
  return items.filter((item) => knowledgeSearchText(item).includes(normalizedQuery))
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

function knowledgeSearchText(item: ConversationKnowledgeItem): string {
  return [
    item.source.title,
    item.knowledge.summary,
    ...item.knowledge.topics,
    ...item.knowledge.conclusions,
    ...item.knowledge.entities
  ]
    .join('\n')
    .toLocaleLowerCase()
}
