import { describe, expect, it } from 'vitest'
import type { ConversationKnowledgeGraph } from '../../../shared/conversation-knowledge-graph'
import type { ConversationKnowledgeItem } from '../../../shared/conversation-knowledge-items'
import {
  conversationKnowledgeItemsInGraph,
  scopeConversationKnowledgeGraphToProject,
  searchConversationKnowledgeGraph
} from './conversation-knowledge-graph-filter'

const item = (id: string, title: string, summary: string): ConversationKnowledgeItem => ({
  id,
  source: {
    executionHostId: 'local',
    agent: 'codex',
    sessionId: id,
    title,
    cwd: '/repo',
    updatedAt: '2026-09-08T00:00:00.000Z'
  },
  knowledge: { title, summary, conclusions: [], topics: [], entities: [] },
  generator: { agent: 'codex', model: 'model', generatedAt: '2026-09-08T00:00:00.000Z' }
})

const graph: ConversationKnowledgeGraph = {
  nodes: [
    { id: 'project:one', type: 'project', label: 'Orca', itemCount: 1 },
    { id: 'project:two', type: 'project', label: 'Website', itemCount: 1 },
    { id: 'topic:git', type: 'topic', label: 'Git workflows', itemCount: 2 },
    {
      id: 'knowledge:one',
      type: 'knowledge',
      label: 'Rebase changes',
      itemCount: 1,
      item: item('one', 'Rebase changes', 'Updated the branch')
    },
    {
      id: 'knowledge:two',
      type: 'knowledge',
      label: 'Release notes',
      itemCount: 1,
      item: item('two', 'Release notes', 'Published the website')
    }
  ],
  edges: [
    { source: 'project:one', target: 'knowledge:one' },
    { source: 'project:two', target: 'knowledge:two' },
    { source: 'topic:git', target: 'knowledge:one' },
    { source: 'topic:git', target: 'knowledge:two' }
  ]
}

describe('conversation knowledge graph filters', () => {
  it('counts only summaries in the selected project scope', () => {
    const scoped = scopeConversationKnowledgeGraphToProject(graph, 'one')
    expect(conversationKnowledgeItemsInGraph(scoped).map((entry) => entry.id)).toEqual(['one'])
  })

  it('fuzzy-searches summary content and keeps its related nodes', () => {
    const result = searchConversationKnowledgeGraph(graph, 'upd brnch')
    expect(conversationKnowledgeItemsInGraph(result).map((entry) => entry.id)).toEqual(['one'])
    expect(result.nodes.map((node) => node.id)).toEqual([
      'project:one',
      'topic:git',
      'knowledge:one'
    ])
  })

  it('searches a relation node and returns every connected summary', () => {
    const result = searchConversationKnowledgeGraph(graph, 'git')
    expect(conversationKnowledgeItemsInGraph(result).map((entry) => entry.id)).toEqual([
      'one',
      'two'
    ])
  })
})
