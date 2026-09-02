import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { translate } from '@/i18n/i18n'
import { consumeConversationHistoryMatch } from '@/lib/conversation-history-selection'
import type {
  AiVaultHistoryMessage,
  AiVaultHistorySearchMatch
} from '../../../../shared/ai-vault-history-types'

type PanelState = 'idle' | 'searching' | 'error'

export default function ConversationKnowledgePanel(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<PanelState>('idle')
  const [matches, setMatches] = useState<AiVaultHistorySearchMatch[]>([])
  const [selected, setSelected] = useState<AiVaultHistorySearchMatch | null>(null)
  const [messages, setMessages] = useState<AiVaultHistoryMessage[]>([])
  const [readError, setReadError] = useState<string | null>(null)

  const search = useCallback(async () => {
    if (!query.trim()) {
      setMatches([])
      setSelected(null)
      setMessages([])
      return
    }
    setState('searching')
    setReadError(null)
    try {
      const result = await window.api.aiVault.searchHistory({ query: query.trim() })
      setMatches(result.matches)
      setSelected(null)
      setMessages([])
      setState('idle')
    } catch {
      setState('error')
    }
  }, [query])

  const selectMatch = useCallback(async (match: AiVaultHistorySearchMatch) => {
    setSelected(match)
    setMessages([])
    setReadError(null)
    try {
      const result = await window.api.aiVault.readHistory({
        agent: match.agent,
        sessionId: match.sessionId
      })
      setMessages(result.messages)
    } catch {
      setReadError(
        translate(
          'auto.components.right.sidebar.ConversationKnowledgePanel.readFailed',
          'Could not read this conversation.'
        )
      )
    }
  }, [])

  useEffect(() => {
    const selectPendingMatch = (): void => {
      const match = consumeConversationHistoryMatch()
      if (match) {
        void selectMatch(match)
      }
    }
    selectPendingMatch()
    window.addEventListener('orca:conversation-history-select', selectPendingMatch)
    return () => window.removeEventListener('orca:conversation-history-select', selectPendingMatch)
  }, [selectMatch])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void search()
              }
            }}
            placeholder={translate(
              'auto.components.right.sidebar.ConversationKnowledgePanel.searchPlaceholder',
              'Search conversation history'
            )}
            aria-label={translate(
              'auto.components.right.sidebar.ConversationKnowledgePanel.searchLabel',
              'Search conversation history'
            )}
          />
          <Button size="icon-sm" onClick={() => void search()} disabled={state === 'searching'}>
            {state === 'searching' ? <Loader2 className="animate-spin" /> : <Search />}
            <span className="sr-only">
              {translate(
                'auto.components.right.sidebar.ConversationKnowledgePanel.searchButton',
                'Search'
              )}
            </span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.right.sidebar.ConversationKnowledgePanel.provenance',
            'Results link to their original session and message.'
          )}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:divide-x lg:divide-y-0">
        <ScrollArea className="min-h-0">
          {state === 'error' ? (
            <p className="p-3 text-sm text-destructive">
              {translate(
                'auto.components.right.sidebar.ConversationKnowledgePanel.searchFailed',
                'Search failed. Try again.'
              )}
            </p>
          ) : matches.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {query.trim()
                ? translate(
                    'auto.components.right.sidebar.ConversationKnowledgePanel.emptySearch',
                    'No matching messages.'
                  )
                : translate(
                    'auto.components.right.sidebar.ConversationKnowledgePanel.emptyPrompt',
                    'Search across your local agent conversations.'
                  )}
            </p>
          ) : (
            <div className="p-1.5">
              {matches.map((match) => (
                <button
                  key={`${match.agent}:${match.sessionId}:${match.message.id}`}
                  type="button"
                  onClick={() => void selectMatch(match)}
                  className="w-full rounded-md px-2.5 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-current={selected?.message.id === match.message.id || undefined}
                >
                  <p className="truncate text-sm font-medium">{match.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {match.message.text}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {match.agent} · {match.message.role}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <ScrollArea className="min-h-0">
          {selected ? (
            <div className="space-y-3 p-3">
              <div>
                <h2 className="text-sm font-medium">{selected.title}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selected.agent} · {selected.sessionId}
                </p>
              </div>
              {readError ? <p className="text-sm text-destructive">{readError}</p> : null}
              {messages.map((message) => (
                <article key={message.id} className="border-l-2 border-border pl-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {message.role}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              {translate(
                'auto.components.right.sidebar.ConversationKnowledgePanel.selectResult',
                'Select a result to inspect its conversation.'
              )}
            </p>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
