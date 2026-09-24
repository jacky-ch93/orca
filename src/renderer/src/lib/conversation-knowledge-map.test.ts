import { describe, expect, it } from 'vitest'
import type { ConversationKnowledgeGraph } from '../../../shared/conversation-knowledge-graph'
import { buildConversationKnowledgeMap } from './conversation-knowledge-map'

const graph: ConversationKnowledgeGraph = {
  nodes: [
    { id: 'concept:architecture', type: 'concept', label: 'Architecture', itemCount: 2 },
    { id: 'concept:ipc', type: 'concept', label: 'IPC', itemCount: 2 },
    { id: 'concept:git', type: 'concept', label: 'Git', itemCount: 1 },
    { id: 'digest:one', type: 'digest', label: 'One', itemCount: 1 },
    { id: 'digest:two', type: 'digest', label: 'Two', itemCount: 1 },
    { id: 'digest:three', type: 'digest', label: 'Three', itemCount: 1 },
    {
      id: 'statement:one',
      type: 'statement',
      label: 'The IPC boundary is stable.',
      itemCount: 1,
      sourceBacked: {
        kind: 'decision',
        reliability: 'verified',
        concepts: ['Architecture', 'IPC']
      }
    },
    {
      id: 'statement:two',
      type: 'statement',
      label: 'Keep API boundaries explicit.',
      itemCount: 1,
      sourceBacked: {
        kind: 'constraint',
        reliability: 'user-confirmed',
        concepts: ['Architecture', 'IPC']
      }
    },
    { id: 'note:architecture', type: 'note', label: 'Architecture', itemCount: 1 }
  ],
  edges: [
    { source: 'digest:one', target: 'concept:architecture', relation: 'about' },
    { source: 'digest:one', target: 'concept:ipc', relation: 'mentions' },
    { source: 'digest:two', target: 'concept:architecture', relation: 'about' },
    { source: 'digest:two', target: 'concept:ipc', relation: 'about' },
    { source: 'digest:three', target: 'concept:git', relation: 'about' },
    { source: 'digest:one', target: 'statement:one', relation: 'records' },
    { source: 'digest:two', target: 'statement:two', relation: 'records' },
    { source: 'concept:architecture', target: 'note:architecture', relation: 'organizes' }
  ]
}

describe('buildConversationKnowledgeMap', () => {
  it('clusters only evidence-backed concepts after they share multiple source digests', () => {
    const clusters = buildConversationKnowledgeMap(graph)

    expect(clusters.map((cluster) => cluster.concepts.map((entry) => entry.concept.id))).toEqual([
      ['concept:architecture', 'concept:ipc']
    ])
  })

  it('keeps statements as evidence metadata instead of map anchors', () => {
    const [cluster] = buildConversationKnowledgeMap(graph)
    const architecture = cluster?.concepts.find(
      (entry) => entry.concept.id === 'concept:architecture'
    )

    expect(architecture).toMatchObject({
      evidenceCount: 2,
      hasKnowledgeNote: true,
      verifiedEvidenceCount: 1
    })
  })

  it('uses a direct literal mention as a conservative legacy fallback', () => {
    const legacy: ConversationKnowledgeGraph = {
      nodes: [
        { id: 'concept:ipc', type: 'concept', label: 'IPC', itemCount: 1 },
        { id: 'digest:one', type: 'digest', label: 'One', itemCount: 1 },
        {
          id: 'statement:one',
          type: 'statement',
          label: 'Keep the IPC boundary stable.',
          itemCount: 1,
          sourceBacked: { kind: 'decision', reliability: 'user-confirmed' }
        }
      ],
      edges: [{ source: 'digest:one', target: 'statement:one', relation: 'records' }]
    }

    expect(buildConversationKnowledgeMap(legacy)[0]?.concepts[0]).toMatchObject({
      concept: { id: 'concept:ipc' },
      evidenceCount: 1
    })
  })
})
