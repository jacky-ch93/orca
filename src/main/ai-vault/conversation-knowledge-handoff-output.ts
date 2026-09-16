import type { ConversationKnowledgeHandoffEntry } from '../../shared/conversation-knowledge-items'

export function normalizeConversationKnowledgeHandoff(
  values: readonly unknown[]
): ConversationKnowledgeHandoffEntry[] {
  return values.flatMap((value) => (isHandoffEntry(value) ? [normalizeEntry(value)] : []))
}

export function retainSourceBackedHandoff(
  handoff: readonly ConversationKnowledgeHandoffEntry[],
  messages: readonly { id: string; role: string }[]
): ConversationKnowledgeHandoffEntry[] {
  const rolesByMessageId = new Map(messages.map((message) => [message.id, message.role]))
  return handoff.filter(
    (entry) =>
      entry.reliability === 'user-confirmed' &&
      entry.evidence.kind === 'conversation' &&
      rolesByMessageId.get(entry.evidence.messageId) === 'user'
  )
}

function normalizeEntry(
  entry: ConversationKnowledgeHandoffEntry
): ConversationKnowledgeHandoffEntry {
  return { ...entry, text: entry.text.trim().slice(0, 500) }
}

function isHandoffEntry(value: unknown): value is ConversationKnowledgeHandoffEntry {
  const record = toRecord(value)
  const evidenceRecord = toRecord(record?.evidence)
  return (
    record !== null &&
    evidenceRecord !== null &&
    (record.kind === 'decision' ||
      record.kind === 'constraint' ||
      record.kind === 'progress' ||
      record.kind === 'open-loop') &&
    typeof record.text === 'string' &&
    record.text.trim().length > 0 &&
    (record.reliability === 'user-confirmed' ||
      record.reliability === 'verified' ||
      record.reliability === 'inferred' ||
      record.reliability === 'proposal') &&
    (evidenceRecord.kind === 'conversation' || evidenceRecord.kind === 'tool-result') &&
    typeof evidenceRecord.messageId === 'string' &&
    evidenceRecord.messageId.length > 0
  )
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
