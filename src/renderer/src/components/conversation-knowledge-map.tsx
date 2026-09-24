import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { buildConversationKnowledgeMap } from '@/lib/conversation-knowledge-map'
import type {
  ConversationKnowledgeGraph,
  ConversationKnowledgeGraphNode
} from '../../../shared/conversation-knowledge-graph'

export function ConversationKnowledgeMap({
  graph,
  selectedConceptId,
  onSelectConcept
}: {
  graph: ConversationKnowledgeGraph
  selectedConceptId: string | null
  onSelectConcept: (concept: ConversationKnowledgeGraphNode) => void
}): React.JSX.Element {
  useTranslation()
  const clusters = useMemo(() => buildConversationKnowledgeMap(graph), [graph])
  if (!clusters.length) {
    return (
      <div className="flex min-h-52 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {translate('conversationKnowledge.map.empty', 'No concepts are available for the map yet.')}
      </div>
    )
  }
  return (
    <div className="scrollbar-sleek h-full min-h-0 overflow-auto rounded-lg border border-border/60 bg-muted/15 p-3">
      <div className="space-y-3">
        {clusters.map((cluster) => (
          <section
            key={cluster.id}
            className="rounded-xl border border-border/60 bg-background/70 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-xs font-medium">
                {cluster.concepts.length > 1
                  ? translate('conversationKnowledge.map.relatedConcepts', 'Related concepts')
                  : translate('conversationKnowledge.map.independentConcept', 'Concept')}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {translate('conversationKnowledge.map.conceptCount', '{{count}} concepts', {
                  count: cluster.concepts.length
                })}
              </span>
            </div>
            <div className="grid gap-2 @min-[520px]/conversation-knowledge:grid-cols-2 @min-[880px]/conversation-knowledge:grid-cols-3">
              {cluster.concepts.map((entry) => (
                <Button
                  key={entry.concept.id}
                  data-current={entry.concept.id === selectedConceptId || undefined}
                  variant="outline"
                  className="h-auto min-h-22 items-start justify-start whitespace-normal p-3 text-left data-[current=true]:border-foreground/40 data-[current=true]:bg-accent"
                  onClick={() => onSelectConcept(entry.concept)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {entry.concept.label}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {translate(
                        'conversationKnowledge.map.evidenceCount',
                        '{{count}} source-backed',
                        {
                          count: entry.evidenceCount
                        }
                      )}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {entry.verifiedEvidenceCount ? (
                        <Badge variant="outline" className="text-[10px]">
                          {translate(
                            'conversationKnowledge.map.verifiedCount',
                            '{{count}} verified',
                            {
                              count: entry.verifiedEvidenceCount
                            }
                          )}
                        </Badge>
                      ) : null}
                      {entry.hasKnowledgeNote ? (
                        <Badge variant="outline" className="text-[10px]">
                          {translate('conversationKnowledge.map.knowledgeNote', 'Knowledge note')}
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
