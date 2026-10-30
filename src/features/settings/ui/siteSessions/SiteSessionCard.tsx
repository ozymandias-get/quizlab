import { getSiteSessionMemberAppName } from '@shared-core/constants/siteSessionMemberApps'
import { googleAccountSlotOptions } from '@shared-core/constants/siteSessionSlots'

import { getAiIcon } from '@ui/components/Icons'

import i18next from 'i18next'
import { memo } from 'react'

import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'
import type { SiteSessionCardProps } from './types'

/**
 * A short, stable hash of a site id.
 *
 * The site id is flattened for the DOM, and two different ids can flatten to
 * the same string (`custom:a.b` and `custom:a-b`), so the hash keeps the
 * element ids apart.
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
 * One site: its name, its host, what the session looks like right now and the
 * switch that pulls the login from Chrome.
 */
function SiteSessionCard({ view, disabled, onToggle, onSelectSlot, t }: SiteSessionCardProps) {
  const idBase = `site-session-${idHash(view.siteId)}`
  const switchId = `${idBase}-switch`
  const icon = getAiIcon(view.kind === 'google' ? 'gemini' : view.memberAppIds[0] || view.siteId)
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
  const importedAt =
    view.status === 'imported' && view.importedAt
      ? new Date(view.importedAt).toLocaleString(i18next.language === 'tr' ? 'tr-TR' : 'en-US')
      : null
  // Every row carries the same visible label, so the switch names its own row:
  // a screen reader has to tell the sites apart.
  const switchLabel = `${t('ws_toggle_label')} — ${t(view.labelKey)} (${view.hostname})`

  return (
    <div className="border-border/60 bg-background/40 flex flex-col gap-2.5 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span
              aria-hidden="true"
              className="text-muted-foreground bg-muted/60 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-ql-13 text-foreground font-semibold">{t(view.labelKey)}</p>
            <p className="text-ql-11 text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label htmlFor={switchId} className="text-ql-11 text-muted-foreground">
            {t('ws_toggle_label')}
          </label>
          <SettingsToggleSwitch
            id={switchId}
            aria-label={switchLabel}
            checked={view.enabled}
            onChange={() => onToggle(view.siteId)}
            disabled={disabled}
            className="shrink-0"
          />
        </div>
      </div>

      <p className="text-ql-12 text-muted-foreground">{t(`ws_status_${view.status}`)}</p>

      {view.lastError && (
        <p className="text-ql-11 text-destructive">{t(`ws_error_${view.lastError}`)}</p>
      )}

      {importedAt && (
        <p className="text-ql-11 text-muted-foreground">
          {t('ws_last_pull', { time: importedAt })}
        </p>
      )}

      {view.kind === 'google' && (
        <div className="border-border/40 mt-0.5 flex items-center gap-2 border-t pt-1">
          <span className="text-ql-11 text-muted-foreground font-medium">
            {t('ws_default_slot')}
          </span>
          <select
            aria-label={`${t('ws_google_account_select')} — ${t(view.labelKey)}`}
            value={view.activeSlot ?? 1}
            disabled={disabled || !view.accountSlots?.length}
            onChange={(event) => onSelectSlot?.(view.siteId, Number(event.target.value))}
            className="text-ql-11 border-border/60 bg-background rounded-md border px-2 py-1"
          >
            {(view.accountSlots?.length
              ? view.accountSlots
              : googleAccountSlotOptions([view.activeSlot ?? 1])
            ).map((slot) => (
              <option key={slot} value={slot}>
                {t('ws_account_slot', { slot: String(slot) })}
              </option>
            ))}
          </select>
        </div>
      )}

      {view.kind === 'google' && (
        <>
          <p className="text-ql-12 text-muted-foreground">{t('ws_google_drive_note')}</p>

          <div className="flex flex-wrap items-center gap-1.5">
            {memberNames.map((name) => (
              <span
                key={name}
                className="bg-muted text-muted-foreground text-ql-11 rounded-full px-2.5 py-1 font-medium"
              >
                {name}
              </span>
            ))}
          </div>
        </>
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
