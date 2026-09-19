import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { ConversationKnowledgeClaimMatch } from '@/lib/conversation-knowledge-claim-search'
import type { ConversationKnowledgeHandoffEntry } from '../../../../shared/conversation-knowledge-items'

export function ConversationKnowledgeClaimResults({
  matches,
  onSelect
}: {
  matches: readonly ConversationKnowledgeClaimMatch[]
  onSelect: (match: ConversationKnowledgeClaimMatch) => void
}): React.JSX.Element | null {
  if (!matches.length) {
    return null
  }
  return (
    <section
      aria-label={translate('conversationKnowledge.claimResults', 'Matching statements')}
      className="mb-3 border-b border-border pb-3"
    >
      <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {translate('conversationKnowledge.claimResults', 'Matching statements')} · {matches.length}
      </h2>
      <ul className="scrollbar-sleek max-h-44 space-y-1 overflow-y-auto">
        {matches.slice(0, 12).map((match) => {
          const { claim, lifecycle, evidence } = match.entry
          return (
            <li key={`${match.item.id}:${evidence.messageId}:${match.entry.text}`}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-1.5 text-left"
                onClick={() => onSelect(match)}
              >
                <span className="min-w-0 space-y-1">
                  <span className="block truncate text-xs font-medium">
                    {claim
                      ? `${claim.subject} → ${claim.relation} → ${claim.object}`
                      : match.entry.text}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant={lifecycle?.status === 'conflicted' ? 'secondary' : 'outline'}>
                      {claimStatusLabel(lifecycle?.status)}
                    </Badge>
                    <span>{claimReliabilityLabel(match.entry.reliability)}</span>
                    <span>
                      {match.item.source.agent} · {match.item.source.sessionId} ·{' '}
                      {evidence.messageId}
                    </span>
                  </span>
                </span>
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function claimReliabilityLabel(
  reliability: ConversationKnowledgeHandoffEntry['reliability']
): string {
  switch (reliability) {
    case 'user-confirmed':
      return translate('conversationKnowledge.detail.handoffUserConfirmed', 'User confirmed')
    case 'verified':
      return translate('conversationKnowledge.detail.handoffVerified', 'Verified')
    case 'inferred':
      return translate('conversationKnowledge.detail.handoffInferred', 'Inferred')
    case 'proposal':
      return translate('conversationKnowledge.detail.handoffProposal', 'Proposal')
  }
}

export function claimStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'conflicted':
      return translate('conversationKnowledge.detail.handoffConflicted', 'Conflicted')
    case 'superseded':
      return translate('conversationKnowledge.detail.handoffSuperseded', 'Superseded')
    case 'expired':
      return translate('conversationKnowledge.detail.handoffExpired', 'Expired')
    default:
      return translate('conversationKnowledge.detail.handoffActive', 'Active')
  }
}
