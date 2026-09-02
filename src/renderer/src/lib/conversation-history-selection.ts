import type { AiVaultHistorySearchMatch } from '../../../shared/ai-vault-history-types'

let pendingMatch: AiVaultHistorySearchMatch | null = null

export function selectConversationHistoryMatch(match: AiVaultHistorySearchMatch): void {
  pendingMatch = match
}

export function consumeConversationHistoryMatch(): AiVaultHistorySearchMatch | null {
  const match = pendingMatch
  pendingMatch = null
  return match
}
