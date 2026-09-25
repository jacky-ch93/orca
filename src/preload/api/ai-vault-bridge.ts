import { createSessionSearchClient } from '../../shared/ai-vault-search-client'
import type { AiVaultSearchRequest, AiVaultSearchStatus } from '../../shared/ai-vault-search-types'
import {
  ALL_EXECUTION_HOSTS_SCOPE,
  LOCAL_EXECUTION_HOST_ID,
  type ExecutionHostId,
  type ExecutionHostScope
} from '../../shared/execution-host'
import { ipcRenderer } from 'electron'
import type {
  AiVaultDeleteSessionArgs,
  AiVaultDeleteSessionResult
} from '../../shared/ai-vault-session-deletion'
import type {
  AiVaultFirstUserPromptArgs,
  AiVaultListArgs,
  AiVaultListResult,
  AiVaultSubagentListArgs
} from '../../shared/ai-vault-types'
import type {
  AiVaultSessionTitlesArgs,
  AiVaultSessionTitlesResult
} from '../../shared/ai-vault-session-title'
import type { AiVaultPrepareSessionResumeArgs } from '../../shared/ai-vault-resume-preparation'
import type { AiVaultAgent } from '../../shared/ai-vault-types'
import type {
  AiVaultHistoryReadResult,
  AiVaultHistorySearchResult
} from '../../shared/ai-vault-history-types'
import type { PreloadApi } from '../api-types'
import type {
  ConversationKnowledgeIndexStatus,
  ConversationKnowledgeItem,
  ConversationKnowledgeListResult,
  GenerateConversationKnowledgeRequest,
  StartConversationKnowledgeIndexRequest
} from '../../shared/conversation-knowledge-items'

function searchClient(
  executionHostScope?: ExecutionHostScope
): ReturnType<typeof createSessionSearchClient> {
  // `all` is merged by this desktop, which already redacted each remote leg.
  const remote =
    executionHostScope !== undefined &&
    executionHostScope !== LOCAL_EXECUTION_HOST_ID &&
    executionHostScope !== ALL_EXECUTION_HOSTS_SCOPE
  return createSessionSearchClient(
    (method, params) =>
      method === 'aiVault.searchSessions'
        ? ipcRenderer.invoke('aiVault:searchSessions', params, executionHostScope)
        : ipcRenderer.invoke('aiVault:searchStatus', executionHostScope),
    remote ? 'relay' : 'ipc'
  )
}

export const aiVaultApi = {
  listSessions: (args?: AiVaultListArgs): Promise<AiVaultListResult> =>
    ipcRenderer.invoke('aiVault:listSessions', args) as Promise<AiVaultListResult>,
  searchHistory: (args: { query: string; limit?: number }): Promise<AiVaultHistorySearchResult> =>
    ipcRenderer.invoke('aiVault:searchHistory', args) as Promise<AiVaultHistorySearchResult>,
  readHistory: (args: {
    agent: AiVaultAgent
    sessionId: string
    limit?: number
  }): Promise<AiVaultHistoryReadResult> =>
    ipcRenderer.invoke('aiVault:readHistory', args) as Promise<AiVaultHistoryReadResult>,
  enrichHistory: (args: GenerateConversationKnowledgeRequest): Promise<ConversationKnowledgeItem> =>
    ipcRenderer.invoke('aiVault:enrichHistory', args) as Promise<ConversationKnowledgeItem>,
  listKnowledge: (args?: {
    query?: string
    scopePaths?: string[]
  }): Promise<ConversationKnowledgeListResult> =>
    ipcRenderer.invoke('aiVault:listKnowledge', args) as Promise<ConversationKnowledgeListResult>,
  startKnowledgeIndex: (
    args: StartConversationKnowledgeIndexRequest
  ): Promise<ConversationKnowledgeIndexStatus> =>
    ipcRenderer.invoke(
      'aiVault:startKnowledgeIndex',
      args
    ) as Promise<ConversationKnowledgeIndexStatus>,
  getKnowledgeIndexStatus: (): Promise<ConversationKnowledgeIndexStatus> =>
    ipcRenderer.invoke(
      'aiVault:getKnowledgeIndexStatus'
    ) as Promise<ConversationKnowledgeIndexStatus>,
  cancelKnowledgeIndex: (): Promise<void> => ipcRenderer.invoke('aiVault:cancelKnowledgeIndex'),
  resolveSessionTitles: (args: AiVaultSessionTitlesArgs): Promise<AiVaultSessionTitlesResult> =>
    ipcRenderer.invoke('aiVault:resolveSessionTitles', args) as Promise<AiVaultSessionTitlesResult>,
  searchSessions: (request: AiVaultSearchRequest, executionHostScope?: ExecutionHostScope) =>
    searchClient(executionHostScope).searchSessions(request),
  searchStatus: (executionHostScope?: ExecutionHostId) =>
    searchClient(executionHostScope).searchStatus(),
  setSearchEnabled: (
    executionHostId: ExecutionHostId,
    enabled: boolean
  ): Promise<AiVaultSearchStatus> =>
    ipcRenderer.invoke('aiVault:setSearchEnabled', executionHostId, enabled),
  clearSearchIndex: (): Promise<void> => ipcRenderer.invoke('aiVault:clearSearchIndex'),
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
