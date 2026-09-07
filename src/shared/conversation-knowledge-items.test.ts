import { describe, expect, it } from 'vitest'
import {
  isConversationKnowledgeItemFresh,
  searchConversationKnowledgeItems,
  type ConversationKnowledgeItem
} from './conversation-knowledge-items'

const baseItem: ConversationKnowledgeItem = {
  id: 'local:codex:session-1',
  source: {
    executionHostId: 'local',
    agent: 'codex',
    sessionId: 'session-1',
    title: 'Fix SSH lifecycle handling',
    cwd: '/code/orca',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  knowledge: {
    summary: 'Loss of contact must not be treated as process exit.',
    topics: ['SSH', 'process lifecycle'],
    conclusions: ['Use live, unverifiable, and exited verdicts.'],
    entities: ['Orca']
  },
  generator: {
    agent: 'codex',
    model: 'gpt-5',
    generatedAt: '2026-09-01T10:01:00.000Z'
  }
}

describe('conversation knowledge items', () => {
  it('searches generated knowledge instead of raw transcript text', () => {
    expect(searchConversationKnowledgeItems([baseItem], 'unverifiable')).toEqual([baseItem])
    expect(searchConversationKnowledgeItems([baseItem], 'unrelated raw prompt')).toEqual([])
  })

  it('invalidates an item when the source session or generator changes', () => {
    expect(
      isConversationKnowledgeItemFresh(baseItem, {
        sourceUpdatedAt: baseItem.source.updatedAt,
        generatorAgent: 'codex',
        generatorModel: 'gpt-5'
      })
    ).toBe(true)
    expect(
      isConversationKnowledgeItemFresh(baseItem, {
        sourceUpdatedAt: '2026-09-02T10:00:00.000Z',
        generatorAgent: 'codex',
        generatorModel: 'gpt-5'
      })
    ).toBe(false)
  })
})
