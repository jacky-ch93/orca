import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'

export type ConversationKnowledgeGraphMode = 'map' | 'graph'

const GRAPH_MODE_ITEM_CLASS =
  'h-6 min-h-6 rounded-sm border border-transparent px-2.5 text-[11px] text-muted-foreground shadow-none hover:bg-background/60 hover:text-foreground data-[state=on]:border-foreground/20 data-[state=on]:bg-background data-[state=on]:font-medium data-[state=on]:text-foreground data-[state=on]:shadow-xs'

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
      <ToggleGroupItem value="map" className={GRAPH_MODE_ITEM_CLASS}>
        {translate('conversationKnowledge.graphMode.map', 'Map')}
      </ToggleGroupItem>
      <ToggleGroupItem value="graph" className={GRAPH_MODE_ITEM_CLASS}>
        {translate('conversationKnowledge.graphMode.graph', 'Graph')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
