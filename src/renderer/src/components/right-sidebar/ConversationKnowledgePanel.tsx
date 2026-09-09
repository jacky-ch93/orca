import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ConversationKnowledgeGraphPreview } from '@/components/conversation-knowledge-graph-preview'
import {
  consumeConversationKnowledgeItem,
  selectConversationKnowledgeItem
} from '@/lib/conversation-knowledge-selection'
import { selectConversationHistoryTarget } from '@/lib/conversation-history-selection'
import { useAppStore } from '@/store'
import { useActiveWorktree, useAllWorktrees } from '@/store/selectors'
import { buildConversationKnowledgeGraph } from '../../../../shared/conversation-knowledge-graph'
import { getCommitMessageAgentSpec } from '../../../../shared/commit-message-agent-spec'
import { translate } from '@/i18n/i18n'
import {
  conversationKnowledgeItemsInGraph,
  scopeConversationKnowledgeGraphToProject,
  searchConversationKnowledgeGraph
} from '@/lib/conversation-knowledge-graph-filter'
import {
  readConversationKnowledgeViewMode,
  writeConversationKnowledgeViewMode,
  type ConversationKnowledgeViewMode
} from '@/lib/conversation-knowledge-view-mode'
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

export default function ConversationKnowledgePanel({
  onClose
}: {
  onClose?: () => void
}): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const repos = useAppStore((state) => state.repos)
  const activeWorktree = useActiveWorktree()
  const worktrees = useAllWorktrees()
  const [items, setItems] = useState<ConversationKnowledgeItem[]>([])
  const [selected, setSelected] = useState<ConversationKnowledgeItem | null>(null)
  const [status, setStatus] = useState<ConversationKnowledgeIndexStatus>(IDLE_STATUS)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ConversationKnowledgeViewMode>(() =>
    typeof window === 'undefined' ? 'all' : readConversationKnowledgeViewMode(window.localStorage)
  )
  const activeProjectId = activeWorktree?.repoId ?? null
  const generatorAgent = settings?.conversationKnowledgeEnrichmentAgent ?? null
  const generatorModel = useMemo(
    () =>
      settings?.conversationKnowledgeEnrichmentModel ??
      (generatorAgent ? getCommitMessageAgentSpec(generatorAgent)?.defaultModelId : null),
    [generatorAgent, settings?.conversationKnowledgeEnrichmentModel]
  )
  const scopePaths = undefined
  const summaryLanguage = typeof navigator === 'undefined' ? 'en' : navigator.language
  const regenerateAll = status.state === 'idle' && status.total > 0 && status.failed === 0
  const fullGraph = useMemo(
    () => buildConversationKnowledgeGraph({ repos, worktrees, items }),
    [items, repos, worktrees]
  )
  const scopedGraph = useMemo(
    () =>
      viewMode === 'project'
        ? scopeConversationKnowledgeGraphToProject(fullGraph, activeProjectId)
        : fullGraph,
    [activeProjectId, fullGraph, viewMode]
  )
  const visibleGraph = useMemo(
    () => searchConversationKnowledgeGraph(scopedGraph, searchQuery),
    [scopedGraph, searchQuery]
  )
  const scopedItems = useMemo(() => conversationKnowledgeItemsInGraph(scopedGraph), [scopedGraph])
  const visibleItems = useMemo(
    () => conversationKnowledgeItemsInGraph(visibleGraph),
    [visibleGraph]
  )
  const visibleSelected =
    visibleItems.find((item) => item.id === selected?.id) ?? visibleItems[0] ?? null

  const refreshKnowledge = useCallback(async () => {
    try {
      const [result, nextStatus] = await Promise.all([
        window.api.aiVault.listKnowledge({ scopePaths }),
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
  }, [scopePaths])

  const startIndex = useCallback(
    async (force = false) => {
      if (!generatorAgent || !generatorModel) {
        return
      }
      try {
        const nextStatus = await window.api.aiVault.startKnowledgeIndex({
          generatorAgent,
          generatorModel,
          scopePaths,
          force,
          language: summaryLanguage
        })
        setStatus(nextStatus)
        setLoadError(null)
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not start knowledge indexing.')
      }
    },
    [generatorAgent, generatorModel, scopePaths, summaryLanguage]
  )

  const stopIndex = useCallback(async () => {
    try {
      await window.api.aiVault.cancelKnowledgeIndex()
      await refreshKnowledge()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not stop knowledge indexing.')
    }
  }, [refreshKnowledge])

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

  useEffect(() => {
    if (status.state === 'running' && generatorAgent && generatorModel) {
      void startIndex(false)
    }
  }, [generatorAgent, generatorModel, startIndex, status.state])

  const chooseItem = (item: ConversationKnowledgeItem): void => {
    selectConversationKnowledgeItem(item)
    setSelected(item)
  }

  const chooseViewMode = (mode: ConversationKnowledgeViewMode): void => {
    setViewMode(mode)
    writeConversationKnowledgeViewMode(window.localStorage, mode)
  }

  return (
    <div className="@container/conversation-knowledge flex min-h-0 flex-1 flex-col bg-transparent">
      <header className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div>
          <h1 className="text-sm font-medium">
            {translate('conversationKnowledge.name', '会话知识')}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI-generated topics, conclusions, and relationships from agent history.
          </p>
          {status.total ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {status.state === 'running' ? 'Indexing' : 'Indexed'} · {status.completed}/
              {status.total} · {status.failed} failed
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {scopedItems.length
              ? `显示 ${visibleItems.length} 项，共 ${scopedItems.length} 项`
              : '暂无知识项'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {(['all', 'project'] as const).map((mode) => (
                <Button
                  key={mode}
                  size="xs"
                  variant={viewMode === mode ? 'secondary' : 'ghost'}
                  onClick={() => chooseViewMode(mode)}
                >
                  {mode === 'all' ? '全部' : '按项目'}
                </Button>
              ))}
            </div>
            <div className="relative w-40 max-w-full">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                className="h-6 bg-muted/20 pr-2 pl-6 text-[11px] shadow-none"
                aria-label="搜索会话知识"
                placeholder="搜索总结或节点"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={!generatorAgent || !generatorModel}
            onClick={() =>
              void (status.state === 'running' ? stopIndex() : startIndex(regenerateAll))
            }
            title={translate(
              regenerateAll
                ? 'conversationKnowledge.regenerateAll'
                : 'conversationKnowledge.generateAll',
              regenerateAll ? '重新生成全部' : '生成全部'
            )}
          >
            {status.state === 'running' ? <Square /> : <RefreshCw />}
            {status.state === 'running'
              ? translate('conversationKnowledge.stop', '停止生成')
              : translate(
                  regenerateAll
                    ? 'conversationKnowledge.regenerateAll'
                    : 'conversationKnowledge.generateAll',
                  regenerateAll ? '重新生成全部' : '生成全部'
                )}
          </Button>
          {onClose ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={onClose}>
                  <X />
                  <span className="sr-only">
                    {translate('auto.components.ui.sheet.1189e9fe0a', 'Close')}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {translate('auto.components.ui.sheet.1189e9fe0a', 'Close')}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
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
              graph={visibleGraph}
              selectedItemId={visibleSelected?.id}
              onSelectItem={chooseItem}
              viewMode={viewMode}
              projectId={activeProjectId}
              emptyMessage={
                searchQuery.trim() ? '没有匹配的总结或关联节点。' : '暂无生成的会话知识。'
              }
            />
          </ScrollArea>
          <ScrollArea className="min-h-0">
            {visibleSelected ? (
              <KnowledgeDetail item={visibleSelected} />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? '没有匹配的总结或关联节点。'
                  : 'Select a topic or knowledge node to inspect its summary and sources.'}
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
    store.setConversationKnowledgeDrawerOpen(false)
    store.setRightSidebarTab('vault')
    store.setRightSidebarOpen(true)
    // The vault is lazy-loaded; retry once after its suspense boundary can mount.
    const dispatchSelection = (): void => {
      window.dispatchEvent(new Event('orca:conversation-history-select'))
    }
    window.setTimeout(dispatchSelection, 0)
    window.setTimeout(dispatchSelection, 120)
  }
  return (
    <article className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-medium">{item.knowledge.title ?? item.source.title}</h2>
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
