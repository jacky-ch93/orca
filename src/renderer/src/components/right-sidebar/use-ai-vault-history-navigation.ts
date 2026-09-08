import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { AiVaultAgent, AiVaultScope } from '../../../../shared/ai-vault-types'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { consumeConversationHistoryTarget } from '@/lib/conversation-history-selection'
import {
  DEFAULT_AI_VAULT_SCOPE,
  getRestorableAiVaultScope,
  normalizeAiVaultScopeForContext
} from './ai-vault-scope-state'
import type { AiVaultSessionLimit } from './ai-vault-session-limit'

export function useAiVaultHistoryNavigation(input: {
  scope: AiVaultScope
  setScope: Dispatch<SetStateAction<AiVaultScope>>
  activeProjectKey: string | null
  activeWorktreePath: string | null
  setQuery: Dispatch<SetStateAction<string>>
  setSessionLimit: (limit: AiVaultSessionLimit) => void
  setAgentEnabled: (agent: AiVaultAgent, enabled: boolean) => void
  setCollapsedGroups: Dispatch<SetStateAction<Set<string>>>
  onExecutionHostScopeChange: (scope: ExecutionHostId) => void
}): { scanAllHistory: boolean; handleScopeChange: (scope: AiVaultScope) => void } {
  const {
    scope,
    setScope,
    activeProjectKey,
    activeWorktreePath,
    setQuery,
    setSessionLimit,
    setAgentEnabled,
    setCollapsedGroups,
    onExecutionHostScopeChange
  } = input
  const [scanAllHistory, setScanAllHistory] = useState(false)
  const userChangedScopeRef = useRef(false)
  const preferredScopeRef = useRef<AiVaultScope>(DEFAULT_AI_VAULT_SCOPE)
  const handleScopeChange = useCallback(
    (scope: AiVaultScope) => {
      preferredScopeRef.current = scope
      userChangedScopeRef.current = scope !== DEFAULT_AI_VAULT_SCOPE
      setScope(scope)
    },
    [setScope]
  )

  useEffect(() => {
    const revealSource = (): void => {
      const target = consumeConversationHistoryTarget()
      if (!target) {
        return
      }
      setScanAllHistory(true)
      preferredScopeRef.current = 'all'
      userChangedScopeRef.current = true
      setQuery(target.sessionId)
      setScope('all')
      setSessionLimit('unlimited')
      setAgentEnabled(target.agent, true)
      setCollapsedGroups(new Set())
      onExecutionHostScopeChange(target.executionHostId)
    }
    revealSource()
    window.addEventListener('orca:conversation-history-select', revealSource)
    return () => window.removeEventListener('orca:conversation-history-select', revealSource)
  }, [
    onExecutionHostScopeChange,
    setAgentEnabled,
    setCollapsedGroups,
    setQuery,
    setScope,
    setSessionLimit
  ])

  useEffect(() => {
    const normalizedScope = normalizeAiVaultScopeForContext({
      scope,
      activeProjectKey,
      activeWorktreePath
    })
    if (normalizedScope !== scope) {
      setScope(normalizedScope)
    }
    const restorableScope = getRestorableAiVaultScope({
      scope,
      activeProjectKey,
      activeWorktreePath,
      preferredScope: preferredScopeRef.current,
      userChangedScope: userChangedScopeRef.current
    })
    if (restorableScope) {
      setScope(restorableScope)
    }
  }, [activeProjectKey, activeWorktreePath, scope, setScope])

  return { scanAllHistory, handleScopeChange }
}
