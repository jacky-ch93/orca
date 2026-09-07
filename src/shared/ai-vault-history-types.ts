import type { NativeChatRole } from './native-chat-types'
import type { AiVaultAgent } from './ai-vault-types'
import type { TuiAgent } from './tui-agent'

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

export type AiVaultSessionEnrichment = {
  summary: string
  topics: string[]
  conclusions: string[]
  entities: string[]
  agent: TuiAgent
  model: string
}
