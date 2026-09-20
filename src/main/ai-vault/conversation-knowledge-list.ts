import type { AiVaultHistoryReadResult } from '../../shared/ai-vault-history-types'
import {
  isAiVaultSessionResumableContent,
  type AiVaultAgent,
  type AiVaultSession
} from '../../shared/ai-vault-types'
import type { ConversationKnowledgeItem } from '../../shared/conversation-knowledge-items'
import { findVerifiedLegacyEmptyIds } from './conversation-knowledge-empty-detection'
import {
  conversationKnowledgeId,
  conversationPathIsWithin,
  isKnowledgeGenerationSession
} from './conversation-knowledge-source-session'
import { visibleConversationKnowledgeItems } from './conversation-knowledge-visible-items'

export async function listConversationKnowledge(input: {
  scopePaths?: readonly string[]
  listSessions(): Promise<AiVaultSession[]>
  readSession(args: { agent: AiVaultAgent; sessionId: string }): Promise<AiVaultHistoryReadResult>
  store: {
    list(): Promise<ConversationKnowledgeItem[]>
    remove(ids: readonly string[]): Promise<void>
  }
}): Promise<ConversationKnowledgeItem[]> {
  const [items, sessions] = await Promise.all([input.store.list(), input.listSessions()])
  const sourceSessions = sessions.filter((session) => !isKnowledgeGenerationSession(session))
  const emptyIds = new Set(
    sourceSessions
      .filter((session) => !isAiVaultSessionResumableContent(session))
      .map(conversationKnowledgeId)
  )
  await input.store.remove(items.filter((item) => emptyIds.has(item.id)).map((item) => item.id))
  const legacyEmptyIds = await findVerifiedLegacyEmptyIds({
    sessions: sourceSessions,
    items,
    knownEmptyIds: emptyIds,
    readSession: input.readSession
  })
  await input.store.remove([...legacyEmptyIds])
  const visible = visibleConversationKnowledgeItems({
    items,
    sourceSessions,
    emptyIds,
    legacyEmptyIds
  })
  const scopePaths = input.scopePaths
  return scopePaths?.length
    ? visible.filter(
        (item) =>
          item.source.cwd !== null &&
          scopePaths.some((path) => conversationPathIsWithin(path, item.source.cwd!))
      )
    : visible
}
