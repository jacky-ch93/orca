import { selectConversationHistoryTarget } from './conversation-history-selection'
import { useAppStore } from '@/store'
import type { ConversationKnowledgeItem } from '../../../shared/conversation-knowledge-items'

export function openConversationKnowledgeSourceHistory(item: ConversationKnowledgeItem): void {
  selectConversationHistoryTarget(item.source)
  const store = useAppStore.getState()
  store.setConversationKnowledgeDrawerOpen(false)
  store.setRightSidebarTab('vault')
  store.setRightSidebarOpen(true)
  const dispatchSelection = (): void => {
    window.dispatchEvent(new Event('orca:conversation-history-select'))
  }
  window.setTimeout(dispatchSelection, 0)
  window.setTimeout(dispatchSelection, 120)
}
