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
      readSession: vi.fn().mockResolvedValue(readableHistory()),
      enrich,
      store: { list: vi.fn().mockResolvedValue([]), upsert, remove: vi.fn() }
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
      readSession: vi.fn().mockResolvedValue(readableHistory()),
      enrich,
      store: {
        list: vi.fn().mockResolvedValue([existing]),
        upsert: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined)
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

  it('does not index the internal sessions created by knowledge generation', async () => {
    const enrich = vi.fn().mockResolvedValue({
      summary: 'Summary',
      topics: [],
      conclusions: [],
      entities: [],
      agent: 'codex',
      model: 'gpt-5'
    })
    const service = new ConversationKnowledgeService({
      listSessions: vi.fn().mockResolvedValue([
        session('real'),
        {
          ...session('internal'),
          title: 'You are an information curator for a developer workspace.'
        }
      ]),
      readSession: vi.fn().mockResolvedValue(readableHistory()),
      enrich,
      store: {
        list: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined)
      }
    })

    await service.startIndex({ generatorAgent: 'codex', generatorModel: 'gpt-5' })
    await vi.waitFor(() => expect(service.getIndexStatus().state).toBe('idle'))

    expect(enrich).toHaveBeenCalledTimes(1)
    expect(enrich.mock.calls[0]?.[0]).toMatchObject({ session: { sessionId: 'real' } })
  })

  it('skips zero-turn sessions and removes their cached summaries', async () => {
    const emptySession = session('empty', { messageCount: 0, previewMessages: [] })
    const remove = vi.fn().mockResolvedValue(undefined)
    const enrich = vi.fn()
    const store = {
      list: vi.fn().mockResolvedValue([knowledgeItem('empty')]),
      upsert: vi.fn().mockResolvedValue(undefined),
      remove
    }
    const service = new ConversationKnowledgeService({
      listSessions: vi.fn().mockResolvedValue([emptySession]),
      readSession: vi.fn(),
      enrich,
      store
    })

    expect(await service.list()).toEqual([])
    await service.startIndex({ generatorAgent: 'codex', generatorModel: 'gpt-5' })

    expect(remove).toHaveBeenCalledWith(['local:claude:empty'])
    expect(enrich).not.toHaveBeenCalled()
    expect(service.getIndexStatus()).toEqual({
      state: 'idle',
      total: 0,
      completed: 0,
      failed: 0
    })
  })

  it('does not invoke an agent when the transcript has no readable messages', async () => {
    const enrich = vi.fn()
    const upsert = vi.fn().mockResolvedValue(undefined)
    const remove = vi.fn().mockResolvedValue(undefined)
    const service = new ConversationKnowledgeService({
      listSessions: vi.fn().mockResolvedValue([session('unreadable')]),
      readSession: vi.fn().mockResolvedValue({ messages: [], truncated: false }),
      enrich,
      store: { list: vi.fn().mockResolvedValue([]), upsert, remove }
    })

    await service.startIndex({ generatorAgent: 'codex', generatorModel: 'gpt-5' })
    await vi.waitFor(() => expect(service.getIndexStatus().state).toBe('idle'))

    expect(enrich).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith(['local:claude:unreadable'])
    expect(service.getIndexStatus()).toEqual({
      state: 'idle',
      total: 1,
      completed: 1,
      failed: 0
    })
  })
})

function session(sessionId: string, overrides: Partial<AiVaultSession> = {}): AiVaultSession {
  return {
    id: `claude:${sessionId}`,
    executionHostId: 'local',
    agent: 'claude',
    sessionId,
    title: sessionId,
    cwd: '/code/orca',
    branch: 'main',
    model: 'claude-sonnet-4-5',
    filePath: `/sessions/${sessionId}.jsonl`,
    codexHome: null,
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    modifiedAt: '2026-09-01T10:00:00.000Z',
    messageCount: 2,
    totalTokens: 100,
    previewMessages: [{ role: 'user', text: 'Question', timestamp: null }],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: '',
    subagent: null,
    ...overrides
  }
}

function readableHistory() {
  return {
    messages: [{ id: 'one', role: 'user' as const, text: 'Question', timestamp: null }],
    truncated: false
  }
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
