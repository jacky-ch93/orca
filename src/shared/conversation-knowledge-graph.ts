import type { ConversationKnowledgeItem } from './conversation-knowledge-items'
import type { Repo } from './repo-types'
import type { Worktree } from './worktree/types'

export type ConversationKnowledgeGraphNode = {
  id: string
  type: 'project' | 'workspace' | 'digest' | 'concept' | 'statement'
  label: string
  itemCount: number
  relevance?: number
  item?: ConversationKnowledgeItem
}

export type ConversationKnowledgeGraphRelation =
  | 'belongs-to'
  | 'occurred-in'
  | 'about'
  | 'mentions'
  | 'contains'

export type ConversationKnowledgeGraphEdge = {
  source: string
  target: string
  relation: ConversationKnowledgeGraphRelation
}

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
  const countedNodeItems = new Set<string>()

  for (const item of items) {
    const digestId = `digest:${item.id}`
    nodes.set(digestId, {
      id: digestId,
      type: 'digest',
      label: item.knowledge.title ?? item.source.title,
      itemCount: 1,
      item
    })
    for (const topic of item.knowledge.topics) {
      connectConceptNode(nodes, edges, countedNodeItems, topic, digestId, 'about')
    }
    for (const entity of item.knowledge.entities) {
      connectConceptNode(nodes, edges, countedNodeItems, entity, digestId, 'mentions')
    }
    connectStatementNodes(nodes, edges, item, digestId)

    const worktree = longestPathMatch(item.source.cwd, worktrees)
    const repo = worktree
      ? repos.find((candidate) => candidate.id === worktree.repoId)
      : longestPathMatch(item.source.cwd, repos)
    if (repo) {
      const projectId = `project:${repo.id}`
      incrementNode(nodes, projectId, 'project', repo.displayName)
      addEdge(edges, digestId, projectId, 'belongs-to')
    }
    if (worktree) {
      const workspaceId = `workspace:${worktree.id}`
      incrementNode(nodes, workspaceId, 'workspace', worktree.branch.replace(/^refs\/heads\//, ''))
      addEdge(edges, digestId, workspaceId, 'occurred-in')
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] }
}

function connectConceptNode(
  nodes: Map<string, ConversationKnowledgeGraphNode>,
  edges: Map<string, ConversationKnowledgeGraphEdge>,
  countedNodeItems: Set<string>,
  label: string,
  digestId: string,
  relation: 'about' | 'mentions'
): void {
  const normalized = normalizeKnowledgeLabel(label)
  if (!normalized) {
    return
  }
  const id = `concept:${normalized.toLocaleLowerCase()}`
  const countKey = `${id}\0${digestId}`
  if (!countedNodeItems.has(countKey)) {
    incrementNode(nodes, id, 'concept', normalized)
    countedNodeItems.add(countKey)
  }
  addEdge(edges, digestId, id, relation)
}

function connectStatementNodes(
  nodes: Map<string, ConversationKnowledgeGraphNode>,
  edges: Map<string, ConversationKnowledgeGraphEdge>,
  item: ConversationKnowledgeItem,
  digestId: string
): void {
  const seen = new Set<string>()
  for (const [index, conclusion] of item.knowledge.conclusions.entries()) {
    const label = normalizeKnowledgeLabel(conclusion)
    const normalized = label.toLocaleLowerCase()
    if (!label || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    const statementId = `statement:${item.id}:${index}`
    nodes.set(statementId, {
      id: statementId,
      type: 'statement',
      label,
      itemCount: 1,
      item
    })
    addEdge(edges, digestId, statementId, 'contains')
  }
}

function normalizeKnowledgeLabel(label: string): string {
  return label.normalize('NFKC').replace(/\s+/g, ' ').trim()
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
  target: string,
  relation: ConversationKnowledgeGraphRelation
): void {
  if (relation === 'mentions' && edges.has(`${source}\0about\0${target}`)) {
    return
  }
  if (relation === 'about') {
    edges.delete(`${source}\0mentions\0${target}`)
  }
  edges.set(`${source}\0${relation}\0${target}`, { source, target, relation })
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
