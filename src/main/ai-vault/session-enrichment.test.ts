import { describe, expect, it } from 'vitest'
import {
  parseConversationKnowledgeOutput,
  redactConversationText,
  resolveConversationKnowledgeModel,
  selectConversationSummaryMessages
} from './session-enrichment'
import { retainSourceBackedHandoff } from './conversation-knowledge-handoff-output'

describe('parseConversationKnowledgeOutput', () => {
  it('redacts common credentials before history is sent to a generator', () => {
    expect(redactConversationText('api_key=sk-test_1234567890abcdef Bearer abcdefghijklmnop')).toBe(
      'api_key: [REDACTED_SECRET] Bearer [REDACTED_TOKEN]'
    )
  })

  it('uses a ChatGPT-compatible Codex model when the CLI rejects gpt-5.4', () => {
    expect(resolveConversationKnowledgeModel('codex', 'gpt-5.4')).toBe('gpt-5.6-sol')
    expect(resolveConversationKnowledgeModel('codex', 'gpt-5.3-codex')).toBe('gpt-5.6-sol')
    expect(resolveConversationKnowledgeModel('codex', 'gpt-5.5')).toBe('gpt-5.5')
  })

  it('parses a structured knowledge response and trims duplicate labels', () => {
    expect(
      parseConversationKnowledgeOutput(`\`\`\`json
        {
          "summary": " The session established the SSH lifecycle contract. ",
          "topics": ["SSH", "SSH", "process lifecycle"],
          "conclusions": ["Loss of contact is unverifiable."],
          "entities": ["Orca"],
          "searchTerms": ["remote disconnect", "remote disconnect", "SSH recovery"]
        }
      \`\`\``)
    ).toEqual({
      summary: 'The session established the SSH lifecycle contract.',
      topics: ['SSH', 'process lifecycle'],
      conclusions: ['Loss of contact is unverifiable.'],
      entities: ['Orca'],
      searchTerms: ['remote disconnect', 'SSH recovery'],
      handoff: []
    })
  })

  it('accepts legacy structured responses without search aliases', () => {
    expect(
      parseConversationKnowledgeOutput(
        '{"summary":"Summary","topics":[],"conclusions":[],"entities":[]}'
      ).searchTerms
    ).toEqual([])
  })

  it('rejects prose so failed generation cannot become cached knowledge', () => {
    expect(() => parseConversationKnowledgeOutput('Here is the summary: ...')).toThrow(
      'structured knowledge JSON'
    )
  })

  it('rejects a user-confirmed handoff when its evidence is not a user message', () => {
    expect(
      retainSourceBackedHandoff(
        [
          {
            kind: 'decision',
            text: 'Use the existing service.',
            reliability: 'user-confirmed',
            evidence: { kind: 'conversation', messageId: 'assistant-1' }
          },
          {
            kind: 'constraint',
            text: 'Keep paths cross-platform.',
            reliability: 'user-confirmed',
            evidence: { kind: 'conversation', messageId: 'user-1' }
          }
        ],
        [
          { id: 'assistant-1', role: 'assistant' },
          { id: 'user-1', role: 'user' }
        ]
      )
    ).toEqual([
      {
        kind: 'constraint',
        text: 'Keep paths cross-platform.',
        reliability: 'user-confirmed',
        evidence: { kind: 'conversation', messageId: 'user-1' }
      }
    ])
  })

  it('samples the beginning, dynamic middle, and ending of long sessions', () => {
    const messages = Array.from({ length: 30 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      text: `message-${index}`
    }))
    const selected = selectConversationSummaryMessages(messages)
    expect(selected).toHaveLength(12)
    const selectedText = selected.map((message) => message.text)
    expect(selectedText.slice(0, 3)).toEqual(['message-0', 'message-1', 'message-2'])
    expect(selectedText.slice(-3)).toEqual(['message-27', 'message-28', 'message-29'])
    const middle = selectedText.slice(3, -3).map((text) => Number(text.slice(8)))
    expect(middle.length).toBe(6)
    expect(new Set(middle).size).toBe(6)
    expect(middle.some((index) => index > 10 && index < 20)).toBe(true)
  })
})
