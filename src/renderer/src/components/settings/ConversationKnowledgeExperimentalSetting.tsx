import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { ALL_TUI_AGENTS, TUI_AGENT_DISPLAY_NAMES } from '../../../../shared/tui-agent-display-names'
import { getCommitMessageAgentSpec } from '../../../../shared/commit-message-agent-spec'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { useAppStore } from '../../store'
import { translate } from '@/i18n/i18n'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { SettingsSwitch } from './SettingsFormControls'
import { SearchableSetting } from './SearchableSetting'
import { isTuiAgentEnabled } from '../../../../shared/tui-agent-selection'

type Props = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function ConversationKnowledgeExperimentalSetting({ settings, updateSettings }: Props) {
  const detectedAgentIds = useAppStore((s) => s.detectedAgentIds)
  const knowledgeAgents = ALL_TUI_AGENTS.filter(
    (agent) =>
      detectedAgentIds?.includes(agent) === true &&
      isTuiAgentEnabled(agent, settings.disabledTuiAgents) &&
      getCommitMessageAgentSpec(agent) !== undefined
  )
  const selectedKnowledgeAgent = knowledgeAgents.includes(
    settings.conversationKnowledgeEnrichmentAgent as TuiAgent
  )
    ? (settings.conversationKnowledgeEnrichmentAgent as TuiAgent)
    : null
  const knowledgeModels = selectedKnowledgeAgent
    ? (getCommitMessageAgentSpec(selectedKnowledgeAgent)?.models ?? [])
    : []

  return (
    <SearchableSetting
      title={translate(
        'auto.components.settings.ExperimentalPane.conversationKnowledge',
        'Conversation Knowledge'
      )}
      description={translate(
        'auto.components.settings.ExperimentalPane.conversationKnowledgeDescription',
        'Build a searchable knowledge layer from agent session history.'
      )}
      keywords={['conversation', 'history', 'knowledge', 'search']}
      className="space-y-3 py-2"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 shrink space-y-0.5">
          <Label>
            {translate(
              'auto.components.settings.ExperimentalPane.conversationKnowledge',
              'Conversation Knowledge'
            )}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.ExperimentalPane.conversationKnowledgeCopy',
              'Adds a graph and detail workspace for exploring generated topics, conclusions, projects, worktrees, and source sessions.'
            )}
          </p>
        </div>
        <SettingsSwitch
          checked={settings.conversationKnowledgeEnabled === true}
          ariaLabel={translate(
            'auto.components.settings.ExperimentalPane.conversationKnowledgeToggle',
            'Toggle Conversation Knowledge'
          )}
          onChange={() =>
            updateSettings({
              conversationKnowledgeEnabled: settings.conversationKnowledgeEnabled !== true
            })
          }
        />
      </div>
      {settings.conversationKnowledgeEnabled === true ? (
        <div className="ml-4 space-y-3 border-l-2 border-border/60 py-2 pl-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 shrink space-y-0.5">
              <Label>
                {translate('conversationKnowledge.enrichment', 'AI Knowledge Enrichment')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'conversationKnowledge.enrichmentCopy',
                  'Automatically turns session history into summaries, topics, conclusions, and graph relationships.'
                )}
              </p>
            </div>
            <SettingsSwitch
              checked={settings.conversationKnowledgeEnrichmentEnabled === true}
              ariaLabel={translate(
                'conversationKnowledge.enrichmentToggle',
                'Toggle AI Knowledge Enrichment'
              )}
              onChange={() =>
                updateSettings({
                  conversationKnowledgeEnrichmentEnabled:
                    settings.conversationKnowledgeEnrichmentEnabled !== true
                })
              }
            />
          </div>
          {settings.conversationKnowledgeEnrichmentEnabled === true ? (
            <div className="space-y-3 border-t border-border pt-3">
              <div>
                <p className="mb-1.5 text-xs font-medium">Summary agent</p>
                <Select
                  value={selectedKnowledgeAgent ?? undefined}
                  onValueChange={(value) => {
                    const agent = value as TuiAgent
                    updateSettings({
                      conversationKnowledgeEnrichmentAgent: agent,
                      conversationKnowledgeEnrichmentModel:
                        getCommitMessageAgentSpec(agent)?.defaultModelId ?? null
                    })
                  }}
                >
                  <SelectTrigger size="sm" className="w-full max-w-72">
                    <SelectValue placeholder="Choose an enabled agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {knowledgeAgents.map((agent) => (
                      <SelectItem key={agent} value={agent}>
                        {TUI_AGENT_DISPLAY_NAMES[agent]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Only detected, enabled agents that support background generation are shown.
                </p>
              </div>
              {selectedKnowledgeAgent ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium">Summary model</p>
                  <Select
                    value={
                      settings.conversationKnowledgeEnrichmentModel ??
                      getCommitMessageAgentSpec(selectedKnowledgeAgent)?.defaultModelId
                    }
                    onValueChange={(model) =>
                      updateSettings({ conversationKnowledgeEnrichmentModel: model })
                    }
                  >
                    <SelectTrigger size="sm" className="w-full max-w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {knowledgeModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div>
                <p className="mb-1.5 text-xs font-medium">Index scope</p>
                <Select
                  value={
                    settings.conversationKnowledgeEnrichmentScope === 'current-project'
                      ? 'current-project'
                      : 'all-history'
                  }
                  onValueChange={(scope) =>
                    updateSettings({
                      conversationKnowledgeEnrichmentScope: scope as
                        | 'current-project'
                        | 'all-history'
                    })
                  }
                >
                  <SelectTrigger size="sm" className="w-full max-w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current-project">Current project</SelectItem>
                    <SelectItem value="all-history">All history</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </SearchableSetting>
  )
}
