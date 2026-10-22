import { Button } from '@shared/ui/components/primitives'

import { memo, useState } from 'react'

import { siteSessionAccountName } from './SiteSessionAccountRow'
import type { SiteSessionPendingRowProps } from './types'

/**
 * The value of the option that asks for a new account.
 *
 * An account id is a uuid or the id of the primary account, so this value
 * cannot name one of them.
 */
const NEW_ACCOUNT = '__new__'

/**
 * The question the app asks when a session cannot be attributed to an account.
 *
 * The session is held by the main process until the user answers: writing it
 * into the wrong account would overwrite the session the user keeps there.
 * The answer is a name the user gives, so nothing is guessed.
 */
function SiteSessionPendingRow({
  siteId,
  accounts,
  disabled,
  onResolve,
  t
}: SiteSessionPendingRowProps) {
  const [selected, setSelected] = useState('')

  const handleResolve = () => {
    if (!selected) return
    onResolve(siteId, selected === NEW_ACCOUNT ? null : selected)
  }

  return (
    <div
      data-testid="site-session-pending-row"
      className="border-destructive/30 bg-destructive/5 flex flex-col gap-2 rounded-lg border p-3"
    >
      <p className="text-ql-12 text-foreground font-semibold">{t('ws_pending_title')}</p>
      <p className="text-ql-11 text-muted-foreground">{t('ws_pending_question')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t('ws_pending_question')}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={disabled}
          className="border-border/80 bg-background/50 focus-visible:ring-foreground/15 h-7 min-w-40 rounded-md border px-2 text-xs outline-none disabled:opacity-50"
        >
          <option value="" disabled>
            {t('ws_pending_question')}
          </option>

          {accounts.map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {siteSessionAccountName(account, t)}
            </option>
          ))}

          <option value={NEW_ACCOUNT}>{t('ws_pending_new_account')}</option>
        </select>

        <Button size="sm" onClick={handleResolve} disabled={disabled || !selected}>
          {t('ws_pending_resolve')}
        </Button>
      </div>
    </div>
  )
}

export default memo(SiteSessionPendingRow)
