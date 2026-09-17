import type { ConversationKnowledgeHandoffEntry } from '../../shared/conversation-knowledge-items'

export function normalizeConversationKnowledgeHandoff(
  values: readonly unknown[]
): ConversationKnowledgeHandoffEntry[] {
  return values.flatMap((value) => (isHandoffEntry(value) ? [normalizeEntry(value)] : []))
}

export function retainSourceBackedHandoff(
  handoff: readonly ConversationKnowledgeHandoffEntry[],
  messages: readonly { id: string; role: string; text?: string }[]
): ConversationKnowledgeHandoffEntry[] {
  const messagesById = new Map(messages.map((message) => [message.id, message]))
  return handoff.flatMap((entry) => {
    const message = messagesById.get(entry.evidence.messageId)
    if (
      entry.reliability !== 'user-confirmed' ||
      entry.evidence.kind !== 'conversation' ||
      message?.role !== 'user'
    ) {
      return []
    }
    if (!entry.claim) {
      return [entry]
    }
    const text = message.text?.normalize('NFKC').toLocaleLowerCase() ?? ''
    const subject = entry.claim.subject.normalize('NFKC').toLocaleLowerCase()
    const object = entry.claim.object.normalize('NFKC').toLocaleLowerCase()
    return [
      subject && object && text.includes(subject) && text.includes(object)
        ? entry
        : { ...entry, claim: undefined }
    ]
  })
}

function normalizeEntry(
  entry: ConversationKnowledgeHandoffEntry
): ConversationKnowledgeHandoffEntry {
  return {
    ...entry,
    text: entry.text.trim().slice(0, 500),
    ...(entry.claim
      ? {
          claim: {
            subject: entry.claim.subject.trim().slice(0, 120),
            relation: entry.claim.relation.trim().slice(0, 120),
            object: entry.claim.object.trim().slice(0, 120),
            cardinality: 'single' as const
          }
        }
      : {})
  }
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
    evidenceRecord.messageId.length > 0 &&
    isOptionalClaim(record.claim)
  )
}

function isOptionalClaim(value: unknown): boolean {
  if (value === undefined) {
    return true
  }
  const claim = toRecord(value)
  return (
    claim !== null &&
    typeof claim.subject === 'string' &&
    typeof claim.relation === 'string' &&
    typeof claim.object === 'string' &&
    claim.cardinality === 'single'
  )
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
