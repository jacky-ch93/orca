import {
  buildConversationKnowledgeContextPack,
  type ConversationKnowledgeItem
} from '../../../shared/conversation-knowledge-items'
import type { ExecutionHostId } from '../../../shared/execution-host'

let launchContextItems: readonly ConversationKnowledgeItem[] = []

export function replaceConversationKnowledgeLaunchItems(
  items: readonly ConversationKnowledgeItem[]
): void {
  launchContextItems = [...items]
}

export function getConversationKnowledgeLaunchItems(): readonly ConversationKnowledgeItem[] {
  return launchContextItems
}

export function buildConversationKnowledgeLaunchPrompt(args: {
  prompt: string
  cwd: string
  executionHostId: ExecutionHostId
  items: readonly ConversationKnowledgeItem[]
}): string {
  const prompt = args.prompt.trim()
  if (!prompt) {
    return ''
  }
  const context = buildConversationKnowledgeContextPack({
    items: args.items.filter((item) => item.source.executionHostId === args.executionHostId),
    cwd: args.cwd
  })
  return context ? `${context}\n\nCurrent task:\n${prompt}` : prompt
}
