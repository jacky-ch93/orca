import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useAllWorktrees } from '@/store/selectors'
import {
  buildConversationKnowledgeGraph,
  type ConversationKnowledgeGraph,
  type ConversationKnowledgeGraphNode
} from '../../../shared/conversation-knowledge-graph'
import type { ConversationKnowledgeItem } from '../../../shared/conversation-knowledge-items'

type PositionedNode = ConversationKnowledgeGraphNode & { x: number; y: number }

const NODE_WIDTH = 176
const NODE_HEIGHT = 64
const COLUMN_X = { project: 18, worktree: 210, topic: 18, entity: 210, knowledge: 430 } as const

export function ConversationKnowledgeGraphPreview({
  items,
  selectedItemId,
  onSelectItem,
  viewMode = 'all',
  projectId = null
}: {
  items: readonly ConversationKnowledgeItem[]
  selectedItemId?: string | null
  onSelectItem: (item: ConversationKnowledgeItem) => void
  viewMode?: 'all' | 'project'
  projectId?: string | null
}): React.JSX.Element {
  const repos = useAppStore((state) => state.repos)
  const worktrees = useAllWorktrees()
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const graph = useMemo(
    () => buildConversationKnowledgeGraph({ repos, worktrees, items }),
    [items, repos, worktrees]
  )
  const visibleGraph = useMemo(
    () => (viewMode === 'project' ? projectGraph(graph, focusedNodeId, projectId) : graph),
    [focusedNodeId, graph, projectId, viewMode]
  )
  const positions = useMemo(() => positionGraphNodes(visibleGraph), [visibleGraph])
  const positionById = useMemo(() => new Map(positions.map((node) => [node.id, node])), [positions])
  const height = Math.max(240, ...positions.map((node) => node.y + NODE_HEIGHT + 18))

  useEffect(() => {
    if (selectedItemId) {
      setFocusedNodeId(`knowledge:${selectedItemId}`)
    }
  }, [selectedItemId])

  if (!positions.length) {
    return (
      <div className="flex min-h-52 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No generated knowledge yet.
      </div>
    )
  }

  return (
    <div className="scrollbar-sleek overflow-auto rounded-lg border border-border/60 bg-muted/15">
      <div className="relative min-w-[630px]" style={{ height }}>
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
                setFocusedNodeId(node.id)
                onSelectItem(node.item)
              } else {
                setFocusedNodeId((current) => (current === node.id ? null : node.id))
              }
            }}
            className="absolute rounded-xl border border-border/70 bg-background/95 px-3 py-2 text-left shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[current=true]:border-foreground/40 data-[current=true]:bg-accent"
            style={{ left: node.x, top: node.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
          >
            <span className="block truncate text-xs font-medium">{node.label}</span>
            <span className="mt-1 block text-[10px] capitalize text-muted-foreground">
              {node.type} · {node.itemCount}
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

function projectGraph(
  graph: ConversationKnowledgeGraph,
  focusedNodeId: string | null,
  projectId: string | null
): ConversationKnowledgeGraph {
  const projectIds = new Set(
    graph.nodes.filter((node) => node.type === 'project').map((node) => node.id)
  )
  const requestedProject = projectId ? `project:${projectId}` : null
  const selectedProject =
    requestedProject && projectIds.has(requestedProject)
      ? requestedProject
      : focusedNodeId && projectIds.has(focusedNodeId)
        ? focusedNodeId
        : null
  const projectKnowledgeIds = new Set(
    graph.edges
      .filter(
        (edge) =>
          projectIds.has(edge.source) && (!selectedProject || edge.source === selectedProject)
      )
      .map((edge) => edge.target)
  )
  const edges = graph.edges.filter(
    (edge) =>
      (!selectedProject && projectIds.has(edge.source)) ||
      (selectedProject && projectIds.has(edge.source) && projectKnowledgeIds.has(edge.target)) ||
      projectKnowledgeIds.has(edge.source) ||
      projectKnowledgeIds.has(edge.target)
  )
  const ids = new Set(edges.flatMap((edge) => [edge.source, edge.target]))
  return { nodes: graph.nodes.filter((node) => ids.has(node.id)), edges }
}

function positionGraphNodes(graph: ConversationKnowledgeGraph): PositionedNode[] {
  const ordered = [...graph.nodes].sort(
    (left, right) =>
      COLUMN_X[left.type] - COLUMN_X[right.type] ||
      right.itemCount - left.itemCount ||
      left.label.localeCompare(right.label)
  )
  return ordered.map((node) => {
    const peers = ordered.filter((peer) => COLUMN_X[peer.type] === COLUMN_X[node.type])
    return {
      ...node,
      x: COLUMN_X[node.type],
      y: 18 + peers.findIndex((peer) => peer.id === node.id) * 82
    }
  })
}
