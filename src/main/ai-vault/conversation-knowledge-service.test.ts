import { describe, expect, it, vi } from 'vitest'
import { ConversationKnowledgeService } from './conversation-knowledge-service'
import type { AiVaultSession } from '../../shared/ai-vault-types'

describe('ConversationKnowledgeService', () => {
  it('keeps the source agent separate from the configured generator agent', async () => {
    const session = {
      executionHostId: 'local',
      agent: 'claude',
      sessionId: 'source-session',
      title: 'Remote process semantics',
      cwd: '/code/orca',
      updatedAt: '2026-09-01T10:00:00.000Z'
    } as AiVaultSession
    const enrich = vi.fn().mockResolvedValue({
      summary: 'Summary',
      topics: ['SSH'],
      conclusions: ['Do not infer exit.'],
      entities: ['Orca'],
      agent: 'codex',
      model: 'gpt-5'
    })
    const upsert = vi.fn().mockResolvedValue(undefined)
    const service = new ConversationKnowledgeService({
      listSessions: vi.fn().mockResolvedValue([session]),
      readSession: vi.fn().mockResolvedValue({ messages: [], truncated: false }),
      enrich,
      store: { list: vi.fn().mockResolvedValue([]), upsert }
    })

    const item = await service.generate({
      sourceAgent: 'claude',
      sessionId: 'source-session',
      generatorAgent: 'codex',
      generatorModel: 'gpt-5'
    })

    expect(enrich).toHaveBeenCalledWith(
      expect.objectContaining({ session, agent: 'codex', model: 'gpt-5' })
    )
    expect(item.source.agent).toBe('claude')
    expect(item.generator.agent).toBe('codex')
    expect(upsert).toHaveBeenCalledWith(item)
  })

  it('indexes only stale sessions and continues after a generation failure', async () => {
    const sessions = [session('one'), session('two')]
    const existing = knowledgeItem('one')
    const enrich = vi
      .fn()
      .mockRejectedValueOnce(new Error('generation failed'))
      .mockResolvedValueOnce({
        summary: 'Summary',
        topics: [],
        conclusions: [],
        entities: [],
        agent: 'codex',
        model: 'gpt-5'
      })
    const service = new ConversationKnowledgeService({
      listSessions: vi.fn().mockResolvedValue(sessions),
      readSession: vi.fn().mockResolvedValue({ messages: [], truncated: false }),
      enrich,
      store: {
        list: vi.fn().mockResolvedValue([existing]),
        upsert: vi.fn().mockResolvedValue(undefined)
      }
    })

    await service.startIndex({ generatorAgent: 'codex', generatorModel: 'gpt-5' })
    await vi.waitFor(() => expect(service.getIndexStatus().state).toBe('idle'))

    expect(enrich).toHaveBeenCalledTimes(1)
    expect(service.getIndexStatus()).toEqual({
      state: 'idle',
      total: 1,
      completed: 0,
      failed: 1
    })
  })
})

function session(sessionId: string): AiVaultSession {
  return {
    executionHostId: 'local',
    agent: 'claude',
    sessionId,
    title: sessionId,
    cwd: '/code/orca',
    updatedAt: '2026-09-01T10:00:00.000Z'
  } as AiVaultSession
}

function knowledgeItem(sessionId: string) {
  return {
    id: `local:claude:${sessionId}`,
    source: {
      executionHostId: 'local' as const,
      agent: 'claude' as const,
      sessionId,
      title: sessionId,
      cwd: '/code/orca',
      updatedAt: '2026-09-01T10:00:00.000Z'
    },
    knowledge: { summary: 'Cached', topics: [], conclusions: [], entities: [] },
    generator: {
      agent: 'codex' as const,
      model: 'gpt-5',
      generatedAt: '2026-09-01T10:01:00.000Z'
    }
  }
}
