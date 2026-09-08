import { ipcRenderer } from 'electron'
import type {
  AiVaultDeleteSessionArgs,
  AiVaultDeleteSessionResult
} from '../../shared/ai-vault-session-deletion'
import type {
  AiVaultFirstUserPromptArgs,
  AiVaultListArgs,
  AiVaultSubagentListArgs
} from '../../shared/ai-vault-types'
import type { AiVaultSessionTitlesArgs } from '../../shared/ai-vault-session-title'
import type { AiVaultPrepareSessionResumeArgs } from '../../shared/ai-vault-resume-preparation'
import type { AiVaultAgent } from '../../shared/ai-vault-types'
import type { PreloadApi } from '../api-types'
import type {
  GenerateConversationKnowledgeRequest,
  StartConversationKnowledgeIndexRequest
} from '../../shared/conversation-knowledge-items'

export const aiVaultApi = {
  listSessions: (args?: AiVaultListArgs): Promise<unknown> =>
    ipcRenderer.invoke('aiVault:listSessions', args),
  searchHistory: (args: { query: string; limit?: number }): Promise<unknown> =>
    ipcRenderer.invoke('aiVault:searchHistory', args),
  readHistory: (args: {
    agent: AiVaultAgent
    sessionId: string
    limit?: number
  }): Promise<unknown> => ipcRenderer.invoke('aiVault:readHistory', args),
  enrichHistory: (args: GenerateConversationKnowledgeRequest): Promise<unknown> =>
    ipcRenderer.invoke('aiVault:enrichHistory', args),
  listKnowledge: (args?: { query?: string; scopePaths?: string[] }): Promise<unknown> =>
    ipcRenderer.invoke('aiVault:listKnowledge', args),
  startKnowledgeIndex: (args: StartConversationKnowledgeIndexRequest): Promise<unknown> =>
    ipcRenderer.invoke('aiVault:startKnowledgeIndex', args),
  getKnowledgeIndexStatus: (): Promise<unknown> =>
    ipcRenderer.invoke('aiVault:getKnowledgeIndexStatus'),
  cancelKnowledgeIndex: (): Promise<void> => ipcRenderer.invoke('aiVault:cancelKnowledgeIndex'),
  resolveSessionTitles: (args: AiVaultSessionTitlesArgs): Promise<unknown> =>
    ipcRenderer.invoke('aiVault:resolveSessionTitles', args),
  cancelListSessions: (args: { requestToken: string }): Promise<void> =>
    ipcRenderer.invoke('aiVault:cancelListSessions', args),
  prepareSessionResume: (args: AiVaultPrepareSessionResumeArgs) =>
    ipcRenderer.invoke('aiVault:prepareSessionResume', args),
  listSubagentSessions: (args: AiVaultSubagentListArgs) =>
    ipcRenderer.invoke('aiVault:listSubagentSessions', args),
  getFirstUserPrompt: (args: AiVaultFirstUserPromptArgs) =>
    ipcRenderer.invoke('aiVault:getFirstUserPrompt', args),
  deleteSession: (args: AiVaultDeleteSessionArgs): Promise<AiVaultDeleteSessionResult> =>
    ipcRenderer.invoke('aiVault:deleteSession', args),
  onWindowFocused: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('aiVault:windowFocused', listener)
    return () => ipcRenderer.removeListener('aiVault:windowFocused', listener)
  }
} satisfies PreloadApi['aiVault']
