import type { ConversationKnowledgeItem } from './conversation-knowledge-items'
import type { Repo } from './repo-types'
import type { Worktree } from './worktree/types'

export type ConversationKnowledgeGraphNode = {
  id: string
  type: 'topic' | 'entity' | 'project' | 'worktree' | 'knowledge'
  label: string
  itemCount: number
  item?: ConversationKnowledgeItem
}

export type ConversationKnowledgeGraphEdge = { source: string; target: string }

export type ConversationKnowledgeGraph = {
  nodes: ConversationKnowledgeGraphNode[]
  edges: ConversationKnowledgeGraphEdge[]
}

export function buildConversationKnowledgeGraph({
  repos,
  items,
  worktrees
}: {
  repos: readonly Repo[]
  worktrees: readonly Worktree[]
  items: readonly ConversationKnowledgeItem[]
}): ConversationKnowledgeGraph {
  const nodes = new Map<string, ConversationKnowledgeGraphNode>()
  const edges = new Map<string, ConversationKnowledgeGraphEdge>()

  for (const item of items) {
    const knowledgeId = `knowledge:${item.id}`
    nodes.set(knowledgeId, {
      id: knowledgeId,
      type: 'knowledge',
      label: item.source.title,
      itemCount: 1,
      item
    })
    for (const topic of item.knowledge.topics) {
      connectLabeledNode(nodes, edges, 'topic', topic, knowledgeId)
    }
    for (const entity of item.knowledge.entities) {
      connectLabeledNode(nodes, edges, 'entity', entity, knowledgeId)
    }
    const worktree = longestPathMatch(item.source.cwd, worktrees)
    const repo = worktree
      ? repos.find((candidate) => candidate.id === worktree.repoId)
      : longestPathMatch(item.source.cwd, repos)
    if (repo) {
      const projectId = `project:${repo.id}`
      incrementNode(nodes, projectId, 'project', repo.displayName)
      addEdge(edges, projectId, knowledgeId)
    }
    if (worktree) {
      const worktreeId = `worktree:${worktree.id}`
      incrementNode(nodes, worktreeId, 'worktree', worktree.branch.replace(/^refs\/heads\//, ''))
      addEdge(edges, worktreeId, knowledgeId)
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] }
}

function connectLabeledNode(
  nodes: Map<string, ConversationKnowledgeGraphNode>,
  edges: Map<string, ConversationKnowledgeGraphEdge>,
  type: 'topic' | 'entity',
  label: string,
  knowledgeId: string
): void {
  const normalized = label.trim()
  if (!normalized) {
    return
  }
  const id = `${type}:${normalized.toLocaleLowerCase()}`
  incrementNode(nodes, id, type, normalized)
  addEdge(edges, id, knowledgeId)
}

function incrementNode(
  nodes: Map<string, ConversationKnowledgeGraphNode>,
  id: string,
  type: ConversationKnowledgeGraphNode['type'],
  label: string
): void {
  const existing = nodes.get(id)
  if (existing) {
    existing.itemCount += 1
  } else {
    nodes.set(id, { id, type, label, itemCount: 1 })
  }
}

function addEdge(
  edges: Map<string, ConversationKnowledgeGraphEdge>,
  source: string,
  target: string
): void {
  edges.set(`${source}:${target}`, { source, target })
}

function longestPathMatch<T extends { path: string }>(
  pathValue: string | null,
  values: readonly T[]
): T | null {
  if (!pathValue) {
    return null
  }
  const normalizedPath = normalizePath(pathValue)
  return (
    values
      .filter((value) => {
        const candidatePath = normalizePath(value.path)
        return normalizedPath === candidatePath || normalizedPath.startsWith(`${candidatePath}/`)
      })
      .sort((a, b) => b.path.length - a.path.length)[0] ?? null
  )
}

function normalizePath(value: string): string {
  const normalized = value.replaceAll('\\', '/').replace(/\/+$/, '')
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLocaleLowerCase() : normalized
}
