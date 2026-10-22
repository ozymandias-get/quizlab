import type { SiteSessionAccountView } from '@shared-core/types/siteSession'

import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { Input } from '@app/components/ui/input'
import { useConfirmDialog } from '@shared/hooks'
import { Button } from '@shared/ui/components/primitives'
import { TrashIcon } from '@ui/components/Icons'

import i18next from 'i18next'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'
import type { SiteSessionAccountRowProps, SiteSessionTranslate } from './types'

/**
 * A short, stable hash of an id.
 *
 * The ids are flattened for the DOM, and two different ids can flatten to the
 * same string (`custom:a.b` and `custom:a-b`), so the hash keeps the element
 * ids apart.
 */
function idHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

/**
 * The name the user sees for an account.
 *
 * An account the user named shows that name. An account without one shows
 * the place it holds in its site, so that the accounts of a site can be told
 * apart even before they are named.
 */
export function siteSessionAccountName(
  account: SiteSessionAccountView,
  t: SiteSessionTranslate
): string {
  return account.name ?? t('ws_account_default', { index: String(account.index) })
}

/**
 * One account of a site.
 *
 * The row carries everything the user needs to tell the accounts of a site
 * apart: the name they gave the account, what the session looks like right
 * now, the switch that pulls it from Chrome, the mark that says which account
 * the panels open with, and the button that removes an additional account.
 *
 * The primary account cannot be removed — it lives in the partition of the
 * platform itself — so its row has no delete button. Its switch is the way to
 * empty it.
 */
function SiteSessionAccountRow({
  siteId,
  siteLabel,
  account,
  disabled,
  actions,
  t
}: SiteSessionAccountRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(account.name ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  // The name is written when the field is left. Leaving it twice — the field
  // disappears right after the Enter — must not write it twice.
  const writtenRef = useRef(false)
  const { confirm, props: confirmProps } = useConfirmDialog()

  const { onToggle, onSetActive, onRename, onDelete } = actions
  const displayName = siteSessionAccountName(account, t)
  const switchId = `site-session-account-${idHash(siteId)}-${idHash(account.accountId)}`
  // Every row carries the same visible label, so the switch names its own
  // row: a screen reader has to tell the accounts of a site apart.
  const switchLabel = `${t('ws_toggle_label')} — ${displayName} (${siteLabel})`
  const importedAt =
    account.status === 'imported' && account.importedAt
      ? new Date(account.importedAt).toLocaleString(i18next.language === 'tr' ? 'tr-TR' : 'en-US')
      : null

  // The name can change while the row is on the screen: another window may
  // have renamed the account.
  useEffect(() => {
    setDraft(account.name ?? '')
  }, [account.name])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const startEditing = useCallback(() => {
    setDraft(account.name ?? '')
    writtenRef.current = false
    setEditing(true)
  }, [account.name])

  const commitName = useCallback(() => {
    if (writtenRef.current) return
    writtenRef.current = true
    setEditing(false)

    const next = draft.trim()
    if (next === (account.name ?? '')) return
    // An empty field means the account has no name again.
    onRename(siteId, account.accountId, next)
  }, [account.accountId, account.name, draft, onRename, siteId])

  const cancelEditing = useCallback(() => {
    setDraft(account.name ?? '')
    setEditing(false)
  }, [account.name])

  const handleDelete = useCallback(async () => {
    const confirmed = await confirm({
      title: t('ws_account_delete'),
      description: t('ws_account_delete_confirm'),
      variant: 'destructive'
    })
    if (!confirmed) return

    onDelete(siteId, account.accountId)
  }, [account.accountId, confirm, onDelete, siteId, t])

  return (
    <div
      data-testid="site-session-account-row"
      className="border-border/45 bg-background/30 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {editing ? (
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitName()
              if (event.key === 'Escape') cancelEditing()
            }}
            aria-label={displayName}
            size="sm"
            className="h-7 max-w-56 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="text-ql-12 text-foreground max-w-56 truncate text-left font-medium hover:underline"
          >
            {displayName}
          </button>
        )}

        {account.name === null && !editing && (
          <span className="text-ql-10 text-muted-foreground">{t('ws_account_unnamed_hint')}</span>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <span className="text-ql-12 text-muted-foreground">{t(`ws_status_${account.status}`)}</span>

        {importedAt && (
          <span className="text-ql-10 text-muted-foreground">
            {t('ws_last_pull', { time: importedAt })}
          </span>
        )}

        {account.lastError && (
          <span className="text-ql-10 text-destructive">{t(`ws_error_${account.lastError}`)}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {account.isActive ? (
          <span
            data-testid="site-session-account-active"
            className="bg-accent/40 text-foreground text-ql-10 rounded-full px-2 py-0.5 font-medium"
          >
            {t('ws_account_active')}
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetActive(siteId, account.accountId)}
            disabled={disabled}
          >
            {t('ws_account_set_active')}
          </Button>
        )}

        <SettingsToggleSwitch
          id={switchId}
          aria-label={switchLabel}
          checked={account.enabled}
          onChange={() => onToggle(siteId, account.accountId)}
          disabled={disabled}
          size="sm"
        />

        {!account.isPrimary && (
          <Button
            variant="destructive-outline"
            size="icon-sm"
            aria-label={t('ws_account_delete')}
            onClick={handleDelete}
            disabled={disabled}
            data-testid="site-session-delete-account"
          >
            <TrashIcon />
          </Button>
        )}
      </div>

      <ConfirmDialog {...confirmProps} />
    </div>
  )
}

/**
 * The rows re-render whenever the list is refreshed, and the props of a row
 * keep the same reference between two refreshes, so the memo keeps the other
 * rows still while one of them changes.
 */
export default memo(SiteSessionAccountRow)
