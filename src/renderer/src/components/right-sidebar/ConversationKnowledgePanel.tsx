import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConversationKnowledgeGraphPreview } from '@/components/conversation-knowledge-graph-preview'
import {
  consumeConversationKnowledgeItem,
  selectConversationKnowledgeItem
} from '@/lib/conversation-knowledge-selection'
import { selectConversationHistoryTarget } from '@/lib/conversation-history-selection'
import { useAppStore } from '@/store'
import { useActiveWorktree } from '@/store/selectors'
import { getCommitMessageAgentSpec } from '../../../../shared/commit-message-agent-spec'
import type {
  ConversationKnowledgeIndexStatus,
  ConversationKnowledgeItem
} from '../../../../shared/conversation-knowledge-items'

const IDLE_STATUS: ConversationKnowledgeIndexStatus = {
  state: 'idle',
  total: 0,
  completed: 0,
  failed: 0
}

export default function ConversationKnowledgePanel(): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const activeWorktree = useActiveWorktree()
  const [items, setItems] = useState<ConversationKnowledgeItem[]>([])
  const [selected, setSelected] = useState<ConversationKnowledgeItem | null>(null)
  const [status, setStatus] = useState<ConversationKnowledgeIndexStatus>(IDLE_STATUS)
  const [loadError, setLoadError] = useState<string | null>(null)
  const generatorAgent = settings?.conversationKnowledgeEnrichmentAgent ?? null
  const generatorModel = useMemo(
    () =>
      settings?.conversationKnowledgeEnrichmentModel ??
      (generatorAgent ? getCommitMessageAgentSpec(generatorAgent)?.defaultModelId : null),
    [generatorAgent, settings?.conversationKnowledgeEnrichmentModel]
  )

  const refreshKnowledge = useCallback(async () => {
    try {
      const [result, nextStatus] = await Promise.all([
        window.api.aiVault.listKnowledge(),
        window.api.aiVault.getKnowledgeIndexStatus()
      ])
      setItems(result.items)
      setSelected(
        (current) => result.items.find((item) => item.id === current?.id) ?? result.items[0] ?? null
      )
      setStatus(nextStatus)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load generated knowledge.')
    }
  }, [])

  const startIndex = useCallback(
    async (force = false) => {
      if (!generatorAgent || !generatorModel) {
        return
      }
      const scopePaths =
        settings?.conversationKnowledgeEnrichmentScope === 'current-project' && activeWorktree
          ? [activeWorktree.path]
          : undefined
      try {
        const nextStatus = await window.api.aiVault.startKnowledgeIndex({
          generatorAgent,
          generatorModel,
          scopePaths,
          force
        })
        setStatus(nextStatus)
        setLoadError(null)
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not start knowledge indexing.')
      }
    },
    [activeWorktree, generatorAgent, generatorModel, settings?.conversationKnowledgeEnrichmentScope]
  )

  useEffect(() => {
    void refreshKnowledge()
    const selectPending = (): void => {
      const item = consumeConversationKnowledgeItem()
      if (item) {
        setSelected(item)
      }
    }
    selectPending()
    window.addEventListener('orca:conversation-knowledge-select', selectPending)
    return () => window.removeEventListener('orca:conversation-knowledge-select', selectPending)
  }, [refreshKnowledge])

  useEffect(() => {
    if (status.state !== 'running') {
      return
    }
    const timer = window.setInterval(() => {
      void refreshKnowledge()
    }, 1_200)
    return () => window.clearInterval(timer)
  }, [refreshKnowledge, status.state])

  const chooseItem = (item: ConversationKnowledgeItem): void => {
    selectConversationKnowledgeItem(item)
    setSelected(item)
  }

  return (
    <div className="@container/conversation-knowledge flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div>
          <h1 className="text-sm font-medium">Conversation Knowledge</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI-generated topics, conclusions, and relationships from agent history.
          </p>
          {status.total ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {status.state === 'running' ? 'Indexing' : 'Indexed'} · {status.completed}/
              {status.total} · {status.failed} failed
            </p>
          ) : null}
        </div>
        <Button
          size="icon-sm"
          variant="outline"
          disabled={!generatorAgent || !generatorModel || status.state === 'running'}
          onClick={() => void startIndex(true)}
        >
          {status.state === 'running' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          <span className="sr-only">Regenerate knowledge</span>
        </Button>
      </header>

      {loadError ? (
        <p className="border-b border-border p-3 text-sm text-destructive">{loadError}</p>
      ) : null}
      {!generatorAgent || !generatorModel ? (
        <div className="p-4 text-sm text-muted-foreground">
          Choose an enabled summary agent and model in Settings → Experimental → Conversation
          Knowledge.
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border @min-[720px]/conversation-knowledge:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] @min-[720px]/conversation-knowledge:divide-x @min-[720px]/conversation-knowledge:divide-y-0">
          <ScrollArea className="min-h-0 p-3">
            <ConversationKnowledgeGraphPreview
              items={items}
              selectedItemId={selected?.id}
              onSelectItem={chooseItem}
            />
          </ScrollArea>
          <ScrollArea className="min-h-0">
            {selected ? (
              <KnowledgeDetail item={selected} />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                Select a topic or knowledge node to inspect its summary and sources.
              </p>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

function KnowledgeDetail({ item }: { item: ConversationKnowledgeItem }): React.JSX.Element {
  const openSourceHistory = (): void => {
    selectConversationHistoryTarget(item.source)
    const store = useAppStore.getState()
    store.setRightSidebarTab('vault')
    store.setRightSidebarOpen(true)
    window.dispatchEvent(new Event('orca:conversation-history-select'))
  }
  return (
    <article className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-medium">{item.source.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Generated by {item.generator.agent} · {item.generator.model}
        </p>
      </div>
      <DetailSection title="Summary">
        <p className="text-sm leading-6">{item.knowledge.summary}</p>
      </DetailSection>
      <DetailList title="Key conclusions" values={item.knowledge.conclusions} />
      <DetailList title="Topics" values={item.knowledge.topics} inline />
      <DetailList title="Entities" values={item.knowledge.entities} inline />
      <DetailSection title="Source">
        <p className="text-xs text-muted-foreground">
          {item.source.agent} · {item.source.sessionId}
        </p>
        <Button className="mt-2" size="sm" variant="outline" onClick={openSourceHistory}>
          Open Agent Session History
        </Button>
      </DetailSection>
    </article>
  )
}

function DetailSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function DetailList({
  title,
  values,
  inline = false
}: {
  title: string
  values: string[]
  inline?: boolean
}): React.JSX.Element | null {
  if (!values.length) {
    return null
  }
  return (
    <DetailSection title={title}>
      <ul className={inline ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'}>
        {values.map((value) => (
          <li
            key={value}
            className={
              inline
                ? 'rounded-md border border-border px-2 py-1 text-xs'
                : 'text-sm leading-5 before:mr-2 before:text-muted-foreground before:content-["•"]'
            }
          >
            {value}
          </li>
        ))}
      </ul>
    </DetailSection>
  )
}
