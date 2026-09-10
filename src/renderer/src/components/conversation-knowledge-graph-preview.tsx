import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translate } from '@/i18n/i18n'
import type {
  ConversationKnowledgeGraph,
  ConversationKnowledgeGraphNode
} from '../../../shared/conversation-knowledge-graph'
import type { ConversationKnowledgeItem } from '../../../shared/conversation-knowledge-items'

type PositionedNode = ConversationKnowledgeGraphNode & { x: number; y: number }
type FocusedNode = { id: string; viewMode: 'all' | 'project'; projectId: string | null }

const NODE_WIDTH = 176
const NODE_HEIGHT = 64
const GRAPH_SIDE_PADDING = 18
const GRAPH_MIN_WIDTH = 630

export function ConversationKnowledgeGraphPreview({
  graph,
  selectedItemId,
  onSelectItem,
  viewMode = 'all',
  projectId = null,
  emptyMessage
}: {
  graph: ConversationKnowledgeGraph
  selectedItemId?: string | null
  onSelectItem: (item: ConversationKnowledgeItem) => void
  viewMode?: 'all' | 'project'
  projectId?: string | null
  emptyMessage?: string
}): React.JSX.Element {
  useTranslation()
  const [focusedNode, setFocusedNode] = useState<FocusedNode | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewportWidth, setViewportWidth] = useState(GRAPH_MIN_WIDTH)
  const focusedNodeId =
    focusedNode?.viewMode === viewMode && focusedNode.projectId === projectId
      ? focusedNode.id
      : null
  const visibleGraph = useMemo(
    () => focusConversationKnowledgeGraph(graph, focusedNodeId),
    [graph, focusedNodeId]
  )
  const canvasWidth = Math.max(GRAPH_MIN_WIDTH, viewportWidth)
  const positions = useMemo(
    () => positionConversationKnowledgeGraphNodes(visibleGraph, canvasWidth),
    [canvasWidth, visibleGraph]
  )
  const positionById = useMemo(() => new Map(positions.map((node) => [node.id, node])), [positions])
  const height = Math.max(240, ...positions.map((node) => node.y + NODE_HEIGHT + 18))

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') {
      return
    }
    const measure = (): void => {
      const nextWidth = viewport.clientWidth
      if (nextWidth > 0) {
        setViewportWidth((current) => (current === nextWidth ? current : nextWidth))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [positions.length])

  if (!positions.length) {
    return (
      <div className="flex min-h-52 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {emptyMessage ??
          translate('conversationKnowledge.empty.generated', 'No generated knowledge yet.')}
      </div>
    )
  }

  return (
    <div
      ref={viewportRef}
      tabIndex={0}
      aria-label={translate('conversationKnowledge.graph', 'Conversation Knowledge Graph')}
      className="scrollbar-sleek h-full min-h-0 overflow-auto overscroll-contain rounded-lg border border-border/60 bg-muted/15 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="relative" style={{ height, width: canvasWidth }}>
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
          {visibleGraph.edges.map((edge) => {
            const source = positionById.get(edge.source)
            const target = positionById.get(edge.target)
            if (!source || !target) {
              return null
            }
            const startX = source.x + NODE_WIDTH
            const startY = source.y + NODE_HEIGHT / 2
            const endX = target.x
            const endY = target.y + NODE_HEIGHT / 2
            const bend = Math.max(32, Math.abs(endX - startX) * 0.42)
            return (
              <path
                key={`${edge.source}:${edge.target}`}
                d={`M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`}
                fill="none"
                opacity="0.6"
                stroke="var(--border)"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            )
          })}
        </svg>
        {positions.map((node) => (
          <button
            key={node.id}
            type="button"
            data-current={node.item?.id === selectedItemId || undefined}
            onClick={() => {
              if (node.item) {
                setFocusedNode((current) =>
                  toggleFocusedNode(current, node.id, viewMode, projectId)
                )
                onSelectItem(node.item)
              } else {
                setFocusedNode((current) =>
                  toggleFocusedNode(current, node.id, viewMode, projectId)
                )
              }
            }}
            className="absolute rounded-xl border border-border/70 bg-background/95 px-3 py-2 text-left shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[current=true]:border-foreground/40 data-[current=true]:bg-accent"
            style={{ left: node.x, top: node.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
          >
            <span className="block truncate text-xs font-medium">{node.label}</span>
            <span className="mt-1 block text-[10px] capitalize text-muted-foreground">
              {conversationKnowledgeNodeTypeLabel(node.type)} · {node.itemCount}
            </span>
            {node.item ? (
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                {node.item.knowledge.title ?? node.item.knowledge.summary}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function conversationKnowledgeNodeTypeLabel(type: ConversationKnowledgeGraphNode['type']): string {
  switch (type) {
    case 'project':
      return translate('conversationKnowledge.nodeType.project', 'Project')
    case 'worktree':
      return translate('conversationKnowledge.nodeType.worktree', 'Worktree')
    case 'topic':
      return translate('conversationKnowledge.nodeType.topic', 'Topic')
    case 'entity':
      return translate('conversationKnowledge.nodeType.entity', 'Entity')
    case 'knowledge':
      return translate('conversationKnowledge.nodeType.knowledge', 'Summary')
  }
}

export function toggleFocusedNode(
  current: FocusedNode | null,
  id: string,
  viewMode: FocusedNode['viewMode'],
  projectId: string | null
): FocusedNode | null {
  return current?.id === id && current.viewMode === viewMode && current.projectId === projectId
    ? null
    : { id, viewMode, projectId }
}

export function focusConversationKnowledgeGraph(
  graph: ConversationKnowledgeGraph,
  focusedNodeId: string | null
): ConversationKnowledgeGraph {
  if (!focusedNodeId || !graph.nodes.some((node) => node.id === focusedNodeId)) {
    return graph
  }
  const relatedIds = new Set(
    graph.edges
      .filter((edge) => edge.source === focusedNodeId || edge.target === focusedNodeId)
      .flatMap((edge) => [edge.source, edge.target])
  )
  relatedIds.add(focusedNodeId)
  return {
    nodes: graph.nodes.filter((node) => relatedIds.has(node.id)),
    edges: graph.edges.filter((edge) => relatedIds.has(edge.source) && relatedIds.has(edge.target))
  }
}

export function positionConversationKnowledgeGraphNodes(
  graph: ConversationKnowledgeGraph,
  canvasWidth: number
): PositionedNode[] {
  const columnX = conversationKnowledgeGraphColumnPositions(canvasWidth)
  const ordered = [...graph.nodes].sort(
    (left, right) =>
      columnX[left.type] - columnX[right.type] ||
      (right.relevance ?? 0) - (left.relevance ?? 0) ||
      right.itemCount - left.itemCount ||
      left.label.localeCompare(right.label)
  )
  return ordered.map((node) => {
    const peers = ordered.filter((peer) => columnX[peer.type] === columnX[node.type])
    return {
      ...node,
      x: columnX[node.type],
      y: 18 + peers.findIndex((peer) => peer.id === node.id) * 82
    }
  })
}

function conversationKnowledgeGraphColumnPositions(
  canvasWidth: number
): Record<ConversationKnowledgeGraphNode['type'], number> {
  const knowledge = Math.max(
    GRAPH_SIDE_PADDING + NODE_WIDTH * 2 + 32,
    canvasWidth - GRAPH_SIDE_PADDING - NODE_WIDTH
  )
  const related = Math.round((GRAPH_SIDE_PADDING + knowledge) / 2)
  return {
    project: GRAPH_SIDE_PADDING,
    topic: GRAPH_SIDE_PADDING,
    worktree: related,
    entity: related,
    knowledge
  }
}
