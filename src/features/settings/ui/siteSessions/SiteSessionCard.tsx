import { getSiteSessionMemberAppName } from '@shared-core/constants/siteSessionMemberApps'

import { memo } from 'react'

import SiteSessionAccountRow from './SiteSessionAccountRow'
import SiteSessionPendingRow from './SiteSessionPendingRow'
import type { SiteSessionCardProps } from './types'

/**
 * One site: its name, its host and the accounts it holds.
 *
 * The switch of a site is gone: every account has its own cookie jar and its
 * own switch, so the switch moved into the row of the account.
 */
function SiteSessionCard({ view, disabled, actions, t }: SiteSessionCardProps) {
  const memberNames =
    view.kind === 'google' ? view.memberAppIds.map(getSiteSessionMemberAppName) : []
  /**
   * The line under the name of the site.
   *
   * A host is the address of its own site and belongs there, but the Google
   * row stands for four apps: the design says the card names the apps it
   * covers, so that row names them instead of listing four addresses.
   */
  const subtitle =
    view.kind === 'google' && memberNames.length > 0 ? memberNames.join(', ') : view.hostname
  const siteLabel = t(view.labelKey)

  return (
    <div className="border-border/60 bg-background/40 flex flex-col gap-2.5 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ql-13 text-foreground font-semibold">{siteLabel}</p>
          <p className="text-ql-11 text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        <span className="bg-muted text-muted-foreground text-ql-11 shrink-0 rounded-full px-2.5 py-1 font-medium">
          {t('ws_accounts_count', { count: String(view.accounts.length) })}
        </span>
      </div>

      {view.hasPendingSession && (
        <SiteSessionPendingRow
          siteId={view.siteId}
          accounts={view.accounts}
          disabled={disabled}
          onResolve={actions.onResolvePending}
          t={t}
        />
      )}

      <div className="flex flex-col gap-1.5">
        {view.accounts.map((account) => (
          <SiteSessionAccountRow
            key={account.accountId}
            siteId={view.siteId}
            siteLabel={siteLabel}
            account={account}
            disabled={disabled}
            actions={actions}
            t={t}
          />
        ))}
      </div>

      {view.kind === 'google' && (
        <p className="text-ql-11 text-muted-foreground">{t('ws_google_drive_note')}</p>
      )}
    </div>
  )
}

/**
 * The rows re-render whenever the list is refreshed, and the props of a row
 * keep the same reference between two refreshes, so the memo keeps the other
 * rows still while one of them changes.
 */
export default memo(SiteSessionCard)
