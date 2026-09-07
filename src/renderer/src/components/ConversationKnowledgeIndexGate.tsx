import { useCallback, useEffect } from 'react'
import { useAppStore } from '@/store'
import { useActiveWorktree } from '@/store/selectors'
import { getCommitMessageAgentSpec } from '../../../shared/commit-message-agent-spec'

export function ConversationKnowledgeIndexGate(): null {
  const settings = useAppStore((state) => state.settings)
  const activeWorktree = useActiveWorktree()
  const enabled =
    settings?.conversationKnowledgeEnabled === true &&
    settings.conversationKnowledgeEnrichmentEnabled === true
  const generatorAgent = settings?.conversationKnowledgeEnrichmentAgent ?? null
  const generatorModel =
    settings?.conversationKnowledgeEnrichmentModel ??
    (generatorAgent ? getCommitMessageAgentSpec(generatorAgent)?.defaultModelId : null)
  const currentProjectOnly = settings?.conversationKnowledgeEnrichmentScope === 'current-project'

  const reconcile = useCallback(() => {
    if (!enabled || !generatorAgent || !generatorModel) {
      return
    }
    const activePath = activeWorktree?.path
    if (currentProjectOnly && !activePath) {
      return
    }
    void window.api.aiVault
      .startKnowledgeIndex({
        generatorAgent,
        generatorModel,
        scopePaths: currentProjectOnly
          ? [activePath].filter((path): path is string => path !== undefined)
          : undefined
      })
      .catch((error) => console.error('[conversation-knowledge] Indexing failed:', error))
  }, [activeWorktree, currentProjectOnly, enabled, generatorAgent, generatorModel])

  useEffect(() => {
    reconcile()
    return window.api.aiVault.onWindowFocused(reconcile)
  }, [reconcile])

  return null
}
