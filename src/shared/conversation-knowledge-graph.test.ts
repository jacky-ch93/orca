import { describe, expect, it } from 'vitest'
import { buildConversationKnowledgeGraph } from './conversation-knowledge-graph'
import type { ConversationKnowledgeItem } from './conversation-knowledge-items'
import type { Repo } from './repo-types'
import type { Worktree } from './worktree/types'

describe('buildConversationKnowledgeGraph', () => {
  it('builds semantic topic and project relationships from generated knowledge', () => {
    const repos = [{ id: 'repo', path: '/code/orca', displayName: 'orca' }] as Repo[]
    const worktrees = [
      { id: 'feature', repoId: 'repo', path: '/code/orca/feature', branch: 'feature' }
    ] as Worktree[]
    const items = [
      knowledgeItem('one', ['SSH', 'process lifecycle']),
      knowledgeItem('two', ['SSH'])
    ]

    const graph = buildConversationKnowledgeGraph({ repos, worktrees, items })

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ id: 'topic:ssh', type: 'topic', label: 'SSH', itemCount: 2 })
    )
    expect(graph.edges).toContainEqual({ source: 'topic:ssh', target: 'knowledge:one' })
    expect(graph.edges).toContainEqual({ source: 'worktree:feature', target: 'knowledge:one' })
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
