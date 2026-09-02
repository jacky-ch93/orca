import type {
  AiVaultPrepareSessionResumeArgs,
  AiVaultPrepareSessionResumeResult
} from '../../shared/ai-vault-resume-preparation'
import type {
  AiVaultSessionTitleRequest,
  AiVaultSessionTitlesResult
} from '../../shared/ai-vault-session-title'
import type { AiVaultAgent, AiVaultListArgs, AiVaultListResult } from '../../shared/ai-vault-types'
import { listAiVaultSessions } from '../ai-vault/cached-session-list'
import {
  readAiVaultHistorySession,
  searchAiVaultHistory,
  type AiVaultHistoryReadResult,
  type AiVaultHistorySearchResult
} from '../ai-vault/session-history'
import { resolveLocalAiVaultSessionTitles } from '../ai-vault/session-title-resolver'

export class RuntimeAiVaultCommands {
  constructor(
    private readonly getPrepareResume: () =>
      | ((args: AiVaultPrepareSessionResumeArgs) => Promise<AiVaultPrepareSessionResumeResult>)
      | null
  ) {}

  list(args?: AiVaultListArgs): Promise<AiVaultListResult> {
    return listAiVaultSessions(args)
  }

  searchHistory(args: {
    query: string
    limit?: number
    scopePaths?: readonly string[]
  }): Promise<AiVaultHistorySearchResult> {
    return searchAiVaultHistory(args)
  }

  readHistory(args: {
    agent: AiVaultAgent
    sessionId: string
    limit?: number
  }): Promise<AiVaultHistoryReadResult> {
    return readAiVaultHistorySession(args)
  }

  resolveTitles(
    requests: AiVaultSessionTitleRequest[],
    signal?: AbortSignal
  ): Promise<AiVaultSessionTitlesResult> {
    return resolveLocalAiVaultSessionTitles(requests, signal)
  }

  prepare(args: AiVaultPrepareSessionResumeArgs): Promise<AiVaultPrepareSessionResumeResult> {
    return this.getPrepareResume()?.(args) ?? Promise.resolve({ useRealCodexHome: false })
  }
}
