import { describe, expect, it } from 'vitest'
import { buildConversationKnowledgeGraph } from './conversation-knowledge-graph'
import type { ConversationKnowledgeItem } from './conversation-knowledge-items'
import type { Repo } from './repo-types'
import type { Worktree } from './worktree/types'

describe('buildConversationKnowledgeGraph', () => {
  it('builds semantic concept, statement, and context relationships from digests', () => {
    const repos = [{ id: 'repo', path: '/code/orca', displayName: 'orca' }] as Repo[]
    const worktrees = [
      { id: 'feature', repoId: 'repo', path: '/code/orca/feature', branch: 'feature' }
    ] as Worktree[]
    const items = [
      knowledgeItem('one', ['SSH', 'process lifecycle']),
      knowledgeItem('two', ['SSH'])
    ]
    items[0].knowledge.entities = ['SSH', 'Codex']
    items[0].knowledge.conclusions = ['Agent status is owned by the execution host.']

    const graph = buildConversationKnowledgeGraph({ repos, worktrees, items })

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ id: 'concept:ssh', type: 'concept', label: 'SSH', itemCount: 2 })
    )
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: 'statement:one:0',
        type: 'statement',
        label: 'Agent status is owned by the execution host.'
      })
    )
    expect(graph.edges).toContainEqual({
      source: 'digest:one',
      target: 'concept:ssh',
      relation: 'about'
    })
    expect(graph.edges).not.toContainEqual({
      source: 'digest:one',
      target: 'concept:ssh',
      relation: 'mentions'
    })
    expect(graph.edges).toContainEqual({
      source: 'digest:one',
      target: 'statement:one:0',
      relation: 'contains'
    })
    expect(graph.edges).toContainEqual({
      source: 'digest:one',
      target: 'workspace:feature',
      relation: 'occurred-in'
    })
    expect(graph.nodes.map((node) => node.type)).not.toContain('conversation')
  })
})

function knowledgeItem(id: string, topics: string[]): ConversationKnowledgeItem {
  return {
    id,
    source: {
      executionHostId: 'local',
      agent: 'codex',
      sessionId: id,
      title: `Knowledge ${id}`,
      cwd: '/code/orca/feature/packages/app',
      updatedAt: '2026-09-01T10:00:00.000Z'
    },
    knowledge: {
      summary: `Summary ${id}`,
      topics,
      conclusions: [],
      entities: []
    },
    generator: {
      agent: 'codex',
      model: 'gpt-5',
      generatedAt: '2026-09-01T10:01:00.000Z'
    }
  }
}
