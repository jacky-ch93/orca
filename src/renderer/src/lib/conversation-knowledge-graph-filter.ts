import type {
  ConversationKnowledgeGraph,
  ConversationKnowledgeGraphNode
} from '../../../shared/conversation-knowledge-graph'
import {
  conversationKnowledgeSearchText,
  type ConversationKnowledgeItem
} from '../../../shared/conversation-knowledge-items'

export function scopeConversationKnowledgeGraphToProject(
  graph: ConversationKnowledgeGraph,
  projectId: string | null
): ConversationKnowledgeGraph {
  const projectIds = new Set(
    graph.nodes.filter((node) => node.type === 'project').map((node) => node.id)
  )
  const requestedProject = projectId ? `project:${projectId}` : null
  const selectedProject =
    requestedProject && projectIds.has(requestedProject) ? requestedProject : null
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

export function searchConversationKnowledgeGraph(
  graph: ConversationKnowledgeGraph,
  query: string
): ConversationKnowledgeGraph {
  const tokens = normalizeQuery(query)
  if (!tokens.length) {
    return graph
  }
  const matchedNodeIds = new Set(
    graph.nodes.filter((node) => nodeMatches(node, tokens)).map((node) => node.id)
  )
  const knowledgeIds = new Set(
    graph.nodes
      .filter((node) => node.type === 'knowledge' && matchedNodeIds.has(node.id))
      .map((node) => node.id)
  )
  for (const edge of graph.edges) {
    if (matchedNodeIds.has(edge.source) || matchedNodeIds.has(edge.target)) {
      const source = graph.nodes.find((node) => node.id === edge.source)
      const target = graph.nodes.find((node) => node.id === edge.target)
      if (source?.type === 'knowledge') {
        knowledgeIds.add(source.id)
      }
      if (target?.type === 'knowledge') {
        knowledgeIds.add(target.id)
      }
    }
  }
  const edges = graph.edges.filter(
    (edge) => knowledgeIds.has(edge.source) || knowledgeIds.has(edge.target)
  )
  const ids = new Set(edges.flatMap((edge) => [edge.source, edge.target]))
  for (const id of knowledgeIds) {
    ids.add(id)
  }
  return { nodes: graph.nodes.filter((node) => ids.has(node.id)), edges }
}

export function conversationKnowledgeItemsInGraph(
  graph: ConversationKnowledgeGraph
): ConversationKnowledgeItem[] {
  return graph.nodes.flatMap((node) => (node.type === 'knowledge' && node.item ? [node.item] : []))
}

function nodeMatches(node: ConversationKnowledgeGraphNode, tokens: string[]): boolean {
  const fields = [
    node.label,
    ...(node.item
      ? [
          conversationKnowledgeSearchText(node.item),
          node.item.source.sessionId,
          node.item.source.agent,
          node.item.source.cwd ?? ''
        ]
      : [])
  ]
  const normalizedFields = fields.map(normalizeText)
  return tokens.every((token) => normalizedFields.some((field) => fuzzyContains(field, token)))
}

function normalizeQuery(query: string): string[] {
  return normalizeText(query).split(' ').filter(Boolean)
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

function fuzzyContains(value: string, query: string): boolean {
  if (value.includes(query)) {
    return true
  }
  let queryIndex = 0
  for (const character of value) {
    if (character === query[queryIndex]) {
      queryIndex += 1
    }
    if (queryIndex === query.length) {
      return true
    }
  }
  return false
}
