import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  createConversationKnowledgeMapLayout,
  knowledgeMapColors,
  linkColorForKnowledgeMap
} from '@/lib/conversation-knowledge-map-layout'
import { cn } from '@/lib/utils'
import {
  buildConversationKnowledgeMap,
  type ConversationKnowledgeMapCluster,
  type ConversationKnowledgeMapConcept
} from '@/lib/conversation-knowledge-map'
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
      <p className="mb-3 text-xs text-muted-foreground">
        {translate(
          'conversationKnowledge.map.linkLegend',
          'Lines connect concepts explicitly associated by the same source-backed statement. Numbers show supporting statements.'
        )}
      </p>
      <div className="space-y-3">
        {clusters.map((cluster, index) => (
          <KnowledgeMapCluster
            key={cluster.id}
            cluster={cluster}
            color={knowledgeMapColors[index % knowledgeMapColors.length]!}
            selectedConceptId={selectedConceptId}
            onSelectConcept={onSelectConcept}
          />
        ))}
      </div>
    </div>
  )
}

function KnowledgeMapCluster({
  cluster,
  color,
  selectedConceptId,
  onSelectConcept
}: {
  cluster: ConversationKnowledgeMapCluster
  color: string
  selectedConceptId: string | null
  onSelectConcept: (concept: ConversationKnowledgeGraphNode) => void
}): React.JSX.Element {
  const layout = createConversationKnowledgeMapLayout(cluster, color)
  const positionById = new Map(
    layout.positions.map((position) => [position.entry.concept.id, position])
  )
  const title =
    cluster.concepts.length > 1
      ? translate('conversationKnowledge.map.relatedConcepts', 'Related concepts')
      : translate('conversationKnowledge.map.independentConcept', 'Concept')
  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-background/70">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2">
        <h2 className="text-xs font-medium">{title}</h2>
        <span className="text-[11px] text-muted-foreground">
          {translate('conversationKnowledge.map.conceptCount', '{{count}} concepts', {
            count: cluster.concepts.length
          })}
        </span>
      </div>
      <div className="scrollbar-sleek overflow-x-auto">
        <div className="relative" style={{ height: layout.height, width: layout.width }}>
          <svg
            aria-label={translate(
              'conversationKnowledge.map.relationships',
              'Concept relationships'
            )}
            className="pointer-events-none absolute inset-0 overflow-visible"
            height={layout.height}
            width={layout.width}
          >
            {layout.links.map((link) => {
              const source = positionById.get(link.source)
              const target = positionById.get(link.target)
              if (!source || !target) {
                return null
              }
              const lineColor = linkColorForKnowledgeMap(
                link,
                layout.colors,
                cluster.concepts[0]!.concept.id
              )
              return (
                <ConceptRelationshipLine
                  key={`${link.source}-${link.target}`}
                  color={lineColor}
                  evidenceCount={link.evidenceCount}
                  source={source}
                  target={target}
                />
              )
            })}
          </svg>
          {layout.positions.map((position, index) => (
            <ConceptMapNode
              key={position.entry.concept.id}
              color={layout.colors.get(position.entry.concept.id) ?? color}
              entry={position.entry}
              isCenter={index === 0}
              isSelected={position.entry.concept.id === selectedConceptId}
              onSelectConcept={onSelectConcept}
              x={position.x}
              y={position.y}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function ConceptRelationshipLine({
  color,
  evidenceCount,
  source,
  target
}: {
  color: string
  evidenceCount: number
  source: { x: number; y: number }
  target: { x: number; y: number }
}): React.JSX.Element {
  const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 }
  return (
    <g>
      <line
        stroke={color}
        strokeOpacity="0.55"
        strokeWidth={Math.min(1 + evidenceCount, 4)}
        x1={source.x}
        x2={target.x}
        y1={source.y}
        y2={target.y}
      />
      <g transform={`translate(${midpoint.x}, ${midpoint.y})`}>
        <rect
          fill="var(--background)"
          height="18"
          rx="9"
          stroke={color}
          strokeOpacity="0.5"
          width="38"
          x="-19"
          y="-9"
        />
        <text
          dominantBaseline="central"
          fill="var(--muted-foreground)"
          fontSize="10"
          textAnchor="middle"
        >
          {evidenceCount}
        </text>
      </g>
    </g>
  )
}

function ConceptMapNode({
  color,
  entry,
  isCenter,
  isSelected,
  onSelectConcept,
  x,
  y
}: {
  color: string
  entry: ConversationKnowledgeMapConcept
  isCenter: boolean
  isSelected: boolean
  onSelectConcept: (concept: ConversationKnowledgeGraphNode) => void
  x: number
  y: number
}): React.JSX.Element {
  const nodeSize = isCenter ? 112 : 84
  return (
    <Button
      aria-label={entry.concept.label}
      className={cn(
        'absolute flex h-auto flex-col items-center justify-center whitespace-normal rounded-full border-2 p-2 text-center shadow-xs hover:brightness-95',
        isCenter ? 'text-sm font-semibold' : 'text-xs font-medium',
        isSelected && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
      )}
      data-current={isSelected || undefined}
      onClick={() => onSelectConcept(entry.concept)}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} ${isCenter ? 24 : 16}%, var(--background))`,
        borderColor: color,
        height: nodeSize,
        left: x - nodeSize / 2,
        top: y - nodeSize / 2,
        width: nodeSize
      }}
      type="button"
      variant="outline"
    >
      <span className="line-clamp-2 max-w-full">{entry.concept.label}</span>
      <span className="mt-1 text-[10px] font-normal text-muted-foreground">
        {translate('conversationKnowledge.map.evidenceCount', '{{count}} source-backed', {
          count: entry.evidenceCount
        })}
      </span>
      {entry.verifiedEvidenceCount || entry.hasKnowledgeNote ? (
        <Badge
          className="mt-1 max-w-full border-border/60 bg-background/70 px-1.5 text-[9px] text-foreground"
          variant="outline"
        >
          {entry.verifiedEvidenceCount
            ? translate('conversationKnowledge.map.verifiedCount', '{{count}} verified', {
                count: entry.verifiedEvidenceCount
              })
            : translate('conversationKnowledge.map.knowledgeNote', 'Knowledge note')}
        </Badge>
      ) : null}
    </Button>
  )
}
