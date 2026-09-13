import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ConversationKnowledgeDetail } from './ConversationKnowledgeDetail'
import type { ConversationKnowledgeItem } from '../../../../shared/conversation-knowledge-items'

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/store', () => ({ useAppStore: { getState: vi.fn() } }))

describe('ConversationKnowledgeDetail', () => {
  it('shows source creation and latest modification times', () => {
    const markup = renderToStaticMarkup(<ConversationKnowledgeDetail item={knowledgeItem()} />)

    expect(markup).toContain('Created')
    expect(markup).toContain('Last modified')
    expect(markup).toContain('dateTime="2026-08-01T09:00:00.000Z"')
    expect(markup).toContain('dateTime="2026-09-02T11:00:00.000Z"')
  })
})

function knowledgeItem(): ConversationKnowledgeItem {
  return {
    id: 'local:codex:session-1',
    source: {
      executionHostId: 'local',
      agent: 'codex',
      sessionId: 'session-1',
      title: 'Session title',
      cwd: '/code/orca',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: null,
      modifiedAt: '2026-09-02T11:00:00.000Z'
    },
    knowledge: {
      summary: 'Summary',
      topics: [],
      conclusions: [],
      entities: []
    },
    generator: {
      agent: 'codex',
      model: 'gpt-5',
      generatedAt: '2026-09-02T12:00:00.000Z'
    }
  }
}
