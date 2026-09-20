import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ConversationKnowledgeItem } from '../../shared/conversation-knowledge-items'
import { writeDurableSecureJsonFile } from '../../shared/secure-file'
import { ensureActiveOrcaProfile } from '../orca-profiles/profile-index-store'

type StoredConversationKnowledge = {
  version: 1
  items: ConversationKnowledgeItem[]
}

const FILE_NAME = 'conversation-knowledge.json'

export class ConversationKnowledgeStore {
  private mutation: Promise<void> = Promise.resolve()

  constructor(private readonly userDataPath: string) {}

  async list(): Promise<ConversationKnowledgeItem[]> {
    await this.mutation
    return this.readSnapshot().then((snapshot) => snapshot.items)
  }

  upsert(item: ConversationKnowledgeItem): Promise<void> {
    const next = this.mutation.then(async () => {
      const snapshot = await this.readSnapshot()
      const existingIndex = snapshot.items.findIndex((candidate) => candidate.id === item.id)
      if (existingIndex === -1) {
        snapshot.items.push(item)
      } else {
        snapshot.items[existingIndex] = item
      }
      await this.writeSnapshot(snapshot)
    })
    this.mutation = next.catch(() => {})
    return next
  }

  remove(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return this.mutation
    }
    const removedIds = new Set(ids)
    const next = this.mutation.then(async () => {
      const snapshot = await this.readSnapshot()
      const items = snapshot.items.filter((item) => !removedIds.has(item.id))
      if (items.length !== snapshot.items.length) {
        await this.writeSnapshot({ ...snapshot, items })
      }
    })
    this.mutation = next.catch(() => {})
    return next
  }

  private async readSnapshot(): Promise<StoredConversationKnowledge> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath(), 'utf8'))
      if (isStoredConversationKnowledge(value)) {
        return value
      }
    } catch {
      // A missing or invalid cache is rebuilt from source conversations.
    }
    return { version: 1, items: [] }
  }

  private async writeSnapshot(snapshot: StoredConversationKnowledge): Promise<void> {
    writeDurableSecureJsonFile(this.filePath(), snapshot)
  }

  private filePath(): string {
    return join(ensureActiveOrcaProfile(this.userDataPath).profileDirectory, FILE_NAME)
  }
}

function isStoredConversationKnowledge(value: unknown): value is StoredConversationKnowledge {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return record.version === 1 && Array.isArray(record.items) && record.items.every(isKnowledgeItem)
}

function isKnowledgeItem(value: unknown): value is ConversationKnowledgeItem {
  if (!value || typeof value !== 'object') {
    return false
  }
  const item = value as Partial<ConversationKnowledgeItem>
  return (
    typeof item.id === 'string' &&
    typeof item.source?.sessionId === 'string' &&
    typeof item.source.title === 'string' &&
    (item.source.createdAt === undefined ||
      item.source.createdAt === null ||
      typeof item.source.createdAt === 'string') &&
    (item.source.modifiedAt === undefined || typeof item.source.modifiedAt === 'string') &&
    typeof item.knowledge?.summary === 'string' &&
    Array.isArray(item.knowledge.topics) &&
    Array.isArray(item.knowledge.conclusions) &&
    Array.isArray(item.knowledge.entities) &&
    (item.knowledge.searchTerms === undefined || Array.isArray(item.knowledge.searchTerms)) &&
    (item.knowledge.handoff === undefined || item.knowledge.handoff.every(isHandoffEntry)) &&
    typeof item.generator?.agent === 'string' &&
    typeof item.generator.model === 'string' &&
    typeof item.generator.generatedAt === 'string' &&
    (item.generator.formatVersion === undefined || typeof item.generator.formatVersion === 'number')
  )
}

function isHandoffEntry(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = toRecord(value)
  if (!record) {
    return false
  }
  const evidence = record.evidence
  const evidenceRecord = toRecord(evidence)
  if (!evidenceRecord) {
    return false
  }
  return (
    (record.kind === 'decision' ||
      record.kind === 'constraint' ||
      record.kind === 'progress' ||
      record.kind === 'open-loop') &&
    typeof record.text === 'string' &&
    (record.reliability === 'user-confirmed' ||
      record.reliability === 'verified' ||
      record.reliability === 'inferred' ||
      record.reliability === 'proposal') &&
    (evidenceRecord.kind === 'conversation' || evidenceRecord.kind === 'tool-result') &&
    typeof evidenceRecord.messageId === 'string' &&
    (evidenceRecord.supportingMessageIds === undefined ||
      (Array.isArray(evidenceRecord.supportingMessageIds) &&
        evidenceRecord.supportingMessageIds.every((messageId) => typeof messageId === 'string'))) &&
    (record.lifecycle === undefined || isLifecycle(record.lifecycle)) &&
    (record.claim === undefined || isClaim(record.claim))
  )
}

function isLifecycle(value: unknown): boolean {
  const record = toRecord(value)
  return (
    record !== null &&
    (record.status === 'active' ||
      record.status === 'superseded' ||
      record.status === 'conflicted' ||
      record.status === 'expired') &&
    (record.reason === undefined || record.reason === 'automatic-conflict')
  )
}

function isClaim(value: unknown): boolean {
  const record = toRecord(value)
  return (
    record !== null &&
    typeof record.subject === 'string' &&
    typeof record.relation === 'string' &&
    typeof record.object === 'string' &&
    record.cardinality === 'single'
  )
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
