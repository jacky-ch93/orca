import { ipcMain } from 'electron'
import { readAiVaultHistorySession, searchAiVaultHistory } from '../ai-vault/session-history'
import { AI_VAULT_AGENTS, type AiVaultAgent } from '../../shared/ai-vault-types'

export function registerAiVaultHistoryHandlers(): void {
  ipcMain.handle('aiVault:searchHistory', (_event, args: { query?: unknown; limit?: unknown }) =>
    searchAiVaultHistory({
      query: typeof args?.query === 'string' ? args.query.slice(0, 512) : '',
      limit: typeof args?.limit === 'number' ? args.limit : undefined
    })
  )
  ipcMain.handle(
    'aiVault:readHistory',
    (_event, args: { agent?: unknown; sessionId?: unknown; limit?: unknown }) =>
      readAiVaultHistorySession({
        agent: isAiVaultAgent(args?.agent) ? args.agent : 'codex',
        sessionId: typeof args?.sessionId === 'string' ? args.sessionId : '',
        limit: typeof args?.limit === 'number' ? args.limit : undefined
      })
  )
}

function isAiVaultAgent(value: unknown): value is AiVaultAgent {
  return typeof value === 'string' && AI_VAULT_AGENTS.includes(value as AiVaultAgent)
}
