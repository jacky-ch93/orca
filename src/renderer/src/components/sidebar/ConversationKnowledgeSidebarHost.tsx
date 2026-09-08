import { useEffect } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useAppStore } from '@/store'
import ConversationKnowledgePanel from '@/components/right-sidebar/ConversationKnowledgePanel'
import { STATUS_BAR_RESERVE_HEIGHT, WORKSPACE_TOP_CHROME_HEIGHT } from './workspace-chrome-metrics'
import { translate } from '@/i18n/i18n'

export default function ConversationKnowledgeSidebarHost({
  sidebarOpen,
  leftSidebarStyle,
  statusBarVisible
}: {
  sidebarOpen: boolean
  leftSidebarStyle?: React.CSSProperties
  statusBarVisible: boolean
}): React.JSX.Element | null {
  const open = useAppStore((s) => s.conversationKnowledgeDrawerOpen)
  const setOpen = useAppStore((s) => s.setConversationKnowledgeDrawerOpen)
  const setAgentDashboardDrawerOpen = useAppStore((s) => s.setAgentDashboardDrawerOpen)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  useEffect(() => {
    if (open) {
      setAgentDashboardDrawerOpen(false)
    }
  }, [open, setAgentDashboardDrawerOpen])
  const left = sidebarOpen ? `var(--workspace-sidebar-live-width, ${sidebarWidth}px)` : '0px'
  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true)
        }
      }}
      modal={false}
    >
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="workspace-kanban-sheet-content bg-background p-0 sm:max-w-none"
        overlayStyle={{
          top: WORKSPACE_TOP_CHROME_HEIGHT,
          bottom: statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0,
          left,
          pointerEvents: 'none'
        }}
        style={
          {
            ...leftSidebarStyle,
            left,
            top: WORKSPACE_TOP_CHROME_HEIGHT,
            bottom: statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0,
            height: 'auto',
            width: `min(calc(100vw - ${left}), 1294px)`
          } as React.CSSProperties
        }
      >
        <SheetTitle className="sr-only">
          {translate('conversationKnowledge.name', '会话知识')}
        </SheetTitle>
        <div className="flex min-h-0 flex-1 flex-col">
          <ConversationKnowledgePanel onClose={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
