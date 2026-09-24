import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'

export type ConversationKnowledgeGraphMode = 'map' | 'graph'

export function ConversationKnowledgeGraphModeSwitch({
  value,
  onChange
}: {
  value: ConversationKnowledgeGraphMode
  onChange: (mode: ConversationKnowledgeGraphMode) => void
}): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={value}
      onValueChange={(next) => {
        if (next === 'map' || next === 'graph') {
          onChange(next)
        }
      }}
      className="h-7 rounded-md border border-border bg-muted/40 p-0.5 shadow-xs"
      aria-label={translate('conversationKnowledge.graphMode.ariaLabel', 'Graph view')}
    >
      <ToggleGroupItem value="map" className="h-6 min-h-6 px-2.5 text-[11px]">
        {translate('conversationKnowledge.graphMode.map', 'Map')}
      </ToggleGroupItem>
      <ToggleGroupItem value="graph" className="h-6 min-h-6 px-2.5 text-[11px]">
        {translate('conversationKnowledge.graphMode.graph', 'Graph')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
