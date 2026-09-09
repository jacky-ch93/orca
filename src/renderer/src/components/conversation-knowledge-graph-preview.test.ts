import { describe, expect, it } from 'vitest'
import type { ConversationKnowledgeGraph } from '../../../shared/conversation-knowledge-graph'
import {
  focusConversationKnowledgeGraph,
  positionConversationKnowledgeGraphNodes,
  toggleFocusedNode
} from './conversation-knowledge-graph-preview'

const graph: ConversationKnowledgeGraph = {
  nodes: [
    { id: 'topic:git', type: 'topic', label: 'Git', itemCount: 2 },
    { id: 'topic:ui', type: 'topic', label: 'UI', itemCount: 1 },
    { id: 'knowledge:one', type: 'knowledge', label: 'One', itemCount: 1 },
    { id: 'knowledge:two', type: 'knowledge', label: 'Two', itemCount: 1 }
  ],
  edges: [
    { source: 'topic:git', target: 'knowledge:one' },
    { source: 'topic:git', target: 'knowledge:two' },
    { source: 'topic:ui', target: 'knowledge:two' }
  ]
}

describe('focusConversationKnowledgeGraph', () => {
  it('keeps the complete graph before a node is selected', () => {
    expect(focusConversationKnowledgeGraph(graph, null)).toBe(graph)
  })

  it('shows every summary directly related to the selected node', () => {
    const focused = focusConversationKnowledgeGraph(graph, 'topic:git')
    expect(focused.nodes.map((node) => node.id)).toEqual([
      'topic:git',
      'knowledge:one',
      'knowledge:two'
    ])
  })

  it('restores the scoped graph when the focused summary is clicked again', () => {
    const focused = { id: 'knowledge:one', viewMode: 'project' as const, projectId: 'orca' }

    expect(toggleFocusedNode(focused, 'knowledge:one', 'project', 'orca')).toBeNull()
    expect(toggleFocusedNode(null, 'knowledge:one', 'project', 'orca')).toEqual(focused)
  })

  it('spreads knowledge summaries to the available right edge', () => {
    const narrow = positionConversationKnowledgeGraphNodes(graph, 630)
    const wide = positionConversationKnowledgeGraphNodes(graph, 900)
    const narrowKnowledge = narrow.find((node) => node.id === 'knowledge:one')
    const wideKnowledge = wide.find((node) => node.id === 'knowledge:one')

    expect(narrowKnowledge?.x).toBe(436)
    expect(wideKnowledge?.x).toBe(706)
    expect(wide.find((node) => node.id === 'topic:git')?.x).toBe(18)
  })
})
