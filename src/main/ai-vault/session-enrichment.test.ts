import { describe, expect, it } from 'vitest'
import {
  parseConversationKnowledgeOutput,
  redactConversationText,
  resolveConversationKnowledgeModel
} from './session-enrichment'

describe('parseConversationKnowledgeOutput', () => {
  it('redacts common credentials before history is sent to a generator', () => {
    expect(redactConversationText('api_key=sk-test_1234567890abcdef Bearer abcdefghijklmnop')).toBe(
      'api_key: [REDACTED_SECRET] Bearer [REDACTED_TOKEN]'
    )
  })

  it('uses a ChatGPT-compatible Codex model when the CLI rejects gpt-5.4', () => {
    expect(resolveConversationKnowledgeModel('codex', 'gpt-5.4')).toBe('gpt-5.3-codex')
    expect(resolveConversationKnowledgeModel('codex', 'gpt-5.5')).toBe('gpt-5.5')
  })

  it('parses a structured knowledge response and trims duplicate labels', () => {
    expect(
      parseConversationKnowledgeOutput(`\`\`\`json
        {
          "summary": " The session established the SSH lifecycle contract. ",
          "topics": ["SSH", "SSH", "process lifecycle"],
          "conclusions": ["Loss of contact is unverifiable."],
          "entities": ["Orca"]
        }
      \`\`\``)
    ).toEqual({
      summary: 'The session established the SSH lifecycle contract.',
      topics: ['SSH', 'process lifecycle'],
      conclusions: ['Loss of contact is unverifiable.'],
      entities: ['Orca']
    })
  })

  it('rejects prose so failed generation cannot become cached knowledge', () => {
    expect(() => parseConversationKnowledgeOutput('Here is the summary: ...')).toThrow(
      'structured knowledge JSON'
    )
  })
})
