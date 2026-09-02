import type { NativeChatRole } from './native-chat-types'
import type { AiVaultAgent } from './ai-vault-types'

export type AiVaultHistoryMessage = {
  id: string
  role: NativeChatRole
  text: string
  timestamp: string | null
}

export type AiVaultHistorySearchMatch = {
  agent: AiVaultAgent
  sessionId: string
  title: string
  updatedAt: string | null
  message: AiVaultHistoryMessage
}

export type AiVaultHistorySearchResult = {
  matches: AiVaultHistorySearchMatch[]
  scannedSessionCount: number
}

export type AiVaultHistoryReadResult = {
  messages: AiVaultHistoryMessage[]
  truncated: boolean
}
