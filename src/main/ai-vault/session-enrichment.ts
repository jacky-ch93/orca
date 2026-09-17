import type { AiVaultSession } from '../../shared/ai-vault-types'
import type { TuiAgent } from '../../shared/tui-agent'
import type { AiVaultSessionEnrichment } from '../../shared/ai-vault-history-types'
import {
  normalizeConversationKnowledgeHandoff,
  retainSourceBackedHandoff
} from './conversation-knowledge-handoff-output'
import { getCommitMessageAgentSpec } from '../../shared/commit-message-agent-spec'
import { planCommitMessageGeneration } from '../../shared/commit-message-plan'
import { spawnSourceControlAgent } from '../text-generation/source-control-agent-launch'
import {
  prepareLocalCommitMessageAgentEnv,
  type CommitMessageAgentEnvironmentResolvers
} from '../text-generation/commit-message-agent-environment'
import { runLocalPlanForAgent } from '../text-generation/source-control-local-generation'
import { discoverCommitMessageModelsLocal } from '../text-generation/commit-message-text-generation'

const MAX_SUMMARY_MESSAGES = 12
const MAX_SUMMARY_MESSAGE_CHARS = 1_200
const MAX_SUMMARY_TRANSCRIPT_CHARS = 12_000

export async function enrichAiVaultSession(input: {
  session: AiVaultSession
  messages: readonly { id: string; role: string; text: string }[]
  agent: TuiAgent
  model?: string | null
  language?: string
  environmentResolvers?: CommitMessageAgentEnvironmentResolvers
}): Promise<AiVaultSessionEnrichment> {
  const spec = getCommitMessageAgentSpec(input.agent)
  if (!spec) {
    throw new Error(`Agent "${input.agent}" does not support non-interactive generation.`)
  }
  const model = input.model?.trim() || spec.defaultModelId
  const transcript = selectConversationSummaryMessages(input.messages)
    .filter((message) => message.text.trim() && ['user', 'assistant'].includes(message.role))
    .map(
      (message) =>
        `[${message.id}] ${message.role.toUpperCase()}: ${redactConversationText(message.text.slice(0, MAX_SUMMARY_MESSAGE_CHARS))}`
    )
    .join('\n\n')
    .slice(0, MAX_SUMMARY_TRANSCRIPT_CHARS)
  const prompt = [
    'You are an information curator for a developer workspace.',
    `Write all human-readable fields in ${summaryLanguage(input.language)}.`,
    'Summarize the conversation below as strict JSON only, with this schema:',
    '{"title":"short descriptive title","summary":"one concise paragraph","topics":["3-6 short labels"],"conclusions":["concrete decisions or outcomes"],"entities":["projects, tools, or technologies"],"searchTerms":["4-8 alternate phrases, synonyms, or likely search queries"],"handoff":[{"kind":"decision|constraint|progress|open-loop","text":"short statement","reliability":"user-confirmed|verified|inferred|proposal","evidence":{"kind":"conversation|tool-result","messageId":"source message id"},"claim":{"subject":"literal subject from user message","relation":"single-valued relation name","object":"literal value from user message","cardinality":"single"}}]}',
    'Do not include markdown fences or commentary. Preserve concrete decisions and outcomes. Keep the title under 80 characters and the summary under 500 characters. Keep search terms short and include common English technical aliases when useful. Only mark user-confirmed or verified when the transcript directly supports it; otherwise use inferred or proposal. Omit claim unless one user message literally names its subject and object and the relation can have only one value in the same workspace.',
    `Conversation title: ${input.session.title}`,
    transcript || '(conversation has no readable user/assistant messages)'
  ].join('\n\n')
  const environment = await prepareLocalCommitMessageAgentEnv(
    input.agent,
    input.environmentResolvers
  )
  if (!environment.ok) {
    throw new Error(environment.error)
  }
  const run = async (modelId: string) => {
    const planned = planCommitMessageGeneration({ agentId: input.agent, model: modelId }, prompt)
    if (!planned.ok) {
      throw new Error(planned.error)
    }
    return runLocalPlanForAgent({
      agentId: input.agent,
      plan: planned.plan,
      target: {
        kind: 'local',
        cwd: input.session.cwd ?? process.cwd(),
        env: environment.env
      },
      emptyResultName: 'knowledge summary',
      operation: 'knowledge-enrichment',
      spawnAgent: spawnSourceControlAgent
    })
  }
  let effectiveModel = model
  let result = await run(model)
  let fallbackModel = codexBackgroundFallbackModel(input.agent, model)
  if (!result.success && isUnsupportedModelFailure(result)) {
    const discovered = await discoverCommitMessageModelsLocal(
      input.agent,
      environment.env,
      undefined,
      {
        cwd: input.session.cwd ?? process.cwd()
      }
    )
    if (discovered.success) {
      fallbackModel = discovered.models.find((entry) => entry.id !== model)?.id ?? fallbackModel
    }
  }
  if (!result.success && fallbackModel && isUnsupportedModelFailure(result)) {
    effectiveModel = fallbackModel
    result = await run(fallbackModel)
  }
  if (!result.success) {
    throw new Error(result.error)
  }
  const parsed = parseConversationKnowledgeOutput(result.rawOutput)
  return {
    ...parsed,
    handoff: retainSourceBackedHandoff(parsed.handoff, input.messages),
    agent: input.agent,
    model: effectiveModel
  }
}

export function selectConversationSummaryMessages<
  T extends { id: string; role: string; text: string }
>(messages: readonly T[]): readonly T[] {
  const readable = messages.filter(
    (message) => message.text.trim() && ['user', 'assistant'].includes(message.role)
  )
  if (readable.length <= MAX_SUMMARY_MESSAGES) {
    return readable
  }
  const headCount = 3
  const tailCount = 3
  const middleBudget = MAX_SUMMARY_MESSAGES - headCount - tailCount
  const middleStart = headCount
  const middleEnd = readable.length - tailCount
  const middle = readable.slice(middleStart, middleEnd)
  const selectedMiddleIndexes = new Set<number>()
  for (let index = 0; index < middleBudget; index += 1) {
    const position = Math.round((index * (middle.length - 1)) / (middleBudget - 1))
    selectedMiddleIndexes.add(position)
  }
  // Replace evenly sampled assistant turns with user turns when possible.
  const userIndexes = middle
    .map((message, index) => (message.role === 'user' ? index : -1))
    .filter((index) => index >= 0)
  for (const userIndex of userIndexes) {
    if (selectedMiddleIndexes.has(userIndex)) {
      continue
    }
    const replaceable = [...selectedMiddleIndexes].find((index) => middle[index]?.role !== 'user')
    if (replaceable === undefined) {
      break
    }
    selectedMiddleIndexes.delete(replaceable)
    selectedMiddleIndexes.add(userIndex)
  }
  const selectedMiddle = [...selectedMiddleIndexes]
    .sort((left, right) => left - right)
    .map((index) => middle[index])
  return [...readable.slice(0, headCount), ...selectedMiddle, ...readable.slice(-tailCount)]
}

function summaryLanguage(language: string | undefined): string {
  const normalized = language?.trim().toLowerCase() ?? ''
  if (normalized.startsWith('zh')) {
    return 'Simplified Chinese'
  }
  if (normalized.startsWith('ja')) {
    return 'Japanese'
  }
  if (normalized.startsWith('ko')) {
    return 'Korean'
  }
  if (normalized.startsWith('es')) {
    return 'Spanish'
  }
  if (normalized.startsWith('fr')) {
    return 'French'
  }
  return 'English'
}

export function resolveConversationKnowledgeModel(agent: TuiAgent, model: string): string {
  const fallback = codexBackgroundFallbackModel(agent, model)
  return fallback ?? model
}

function codexBackgroundFallbackModel(agent: TuiAgent, model: string): string | null {
  if (agent !== 'codex' || !/^gpt-5\.(3|4)(?:-.*)?$/.test(model)) {
    return null
  }
  return getCommitMessageAgentSpec(agent)?.models.some((entry) => entry.id === 'gpt-5.6-sol')
    ? 'gpt-5.6-sol'
    : null
}

function isUnsupportedModelFailure(result: { failureOutput?: { stderr: string } }): boolean {
  return /model.+not supported/i.test(result.failureOutput?.stderr ?? '')
}

export function parseConversationKnowledgeOutput(
  rawOutput: string
): Pick<
  AiVaultSessionEnrichment,
  'title' | 'summary' | 'topics' | 'conclusions' | 'entities' | 'searchTerms' | 'handoff'
> {
  const text = rawOutput
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Agent did not return structured knowledge JSON.')
  }
  if (!isEnrichment(value)) {
    throw new Error('Agent did not return structured knowledge JSON.')
  }
  return {
    title: typeof value.title === 'string' ? value.title.trim().slice(0, 120) : undefined,
    summary: value.summary.trim().slice(0, 2_000),
    topics: normalizeLabels(value.topics, 12),
    conclusions: normalizeLabels(value.conclusions, 12),
    entities: normalizeLabels(value.entities, 20),
    searchTerms: normalizeLabels(value.searchTerms ?? [], 16),
    handoff: normalizeConversationKnowledgeHandoff(value.handoff ?? [])
  }
}

export function redactConversationText(text: string): string {
  return text
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\b(?:sk|ghp|github_pat|xox[baprs])-[-A-Za-z0-9_]{12,}\b/g, '[REDACTED_TOKEN]')
    .replace(/\bAIza[\w-]{20,}\b/g, '[REDACTED_TOKEN]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|secret)\s*[:=]\s*(["']?)[^\s"']{8,}\2/gi,
      '$1: [REDACTED_SECRET]'
    )
}

function isEnrichment(value: unknown): value is {
  title?: string
  summary: string
  topics: string[]
  conclusions: string[]
  entities: string[]
  searchTerms?: string[]
  handoff?: unknown[]
} {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    (record.title === undefined || typeof record.title === 'string') &&
    typeof record.summary === 'string' &&
    record.summary.trim().length > 0 &&
    Array.isArray(record.topics) &&
    Array.isArray(record.conclusions) &&
    Array.isArray(record.entities) &&
    (record.searchTerms === undefined || Array.isArray(record.searchTerms)) &&
    (record.handoff === undefined || Array.isArray(record.handoff)) &&
    [
      ...record.topics,
      ...record.conclusions,
      ...record.entities,
      ...(record.searchTerms ?? [])
    ].every((entry) => typeof entry === 'string')
  )
}

function normalizeLabels(values: readonly string[], limit: number): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .slice(0, limit)
    .map((value) => value.slice(0, 240))
}
