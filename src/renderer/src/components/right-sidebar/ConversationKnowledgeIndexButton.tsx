import { RefreshCw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

export function ConversationKnowledgeIndexButton({
  running,
  regenerateAll,
  disabled,
  onClick
}: {
  running: boolean
  regenerateAll: boolean
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  const key = regenerateAll
    ? 'conversationKnowledge.regenerateAll'
    : 'conversationKnowledge.generateAll'
  const label = translate(key, regenerateAll ? 'Regenerate all' : 'Generate all')
  return (
    <Button size="sm" variant="outline" disabled={disabled} onClick={onClick} title={label}>
      {running ? <Square /> : <RefreshCw />}
      {running ? translate('conversationKnowledge.stop', 'Stop generating') : label}
    </Button>
  )
}
