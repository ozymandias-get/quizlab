import { getSiteSessionMemberAppName } from '@shared-core/constants/siteSessionMemberApps'
import type { SiteSessionView } from '@shared-core/types/siteSession'

import { InlineSpinner, WithTooltip } from '@shared/ui/components/primitives'
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

/** Colour of the readiness dot next to the status summary. */
function statusDotTone(status: SiteSessionView['status']): string {
  switch (status) {
    case 'imported':
    case 'manual_session':
    case 'extension_connected':
      return 'bg-emerald-500'
    case 'import_failed':
      return 'bg-destructive'
    case 'signed_out':
    case 'no_cookies_in_browser':
    case 'permission_missing':
    case 'extension_missing':
    case 'extension_outdated':
      return 'bg-amber-500'
    default:
      return 'bg-muted-foreground'
  }
}

/**
 * One site: favicon and name on the left, host/app subtitle and the readiness
 * summary in the middle, and the independent switch on the far right.
 */
function SiteSessionCard({
  view,
  disabled,
  onToggle,
  isClearing = false,
  t
}: SiteSessionCardProps) {
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
    <div className="flex flex-col gap-2.5 rounded-xl border border-white/[0.07] bg-zinc-900/45 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className="text-muted-foreground flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.04]"
          >
            {icon ?? (
              <span className="text-ql-13 text-foreground font-bold uppercase">
                {t(view.labelKey).charAt(0)}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <WithTooltip
              label={t(view.labelKey)}
              contentClassName="max-w-[min(22rem,80vw)] whitespace-normal break-words"
            >
              <p className="text-ql-13 text-foreground font-semibold [overflow-wrap:anywhere] break-words">
                {t(view.labelKey)}
              </p>
            </WithTooltip>
            <WithTooltip
              label={subtitle}
              contentClassName="max-w-[min(22rem,80vw)] whitespace-normal break-words"
            >
              <p className="text-ql-11 text-muted-foreground mt-0.5 [overflow-wrap:anywhere] break-words">
                {subtitle}
              </p>
            </WithTooltip>
            {/* Readiness lives with the name, not buried under the switch. */}
            <p className="text-ql-11 text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${statusDotTone(view.status)}`}
              />
              <span className="truncate">{t(`ws_status_${view.status}`)}</span>
            </p>
          </div>
        </div>

        <div
          className="flex shrink-0 flex-col items-end gap-1.5"
          aria-busy={isClearing || undefined}
        >
          <label htmlFor={switchId} className="text-ql-11 text-muted-foreground font-medium">
            {t('ws_toggle_label')}
          </label>
          {isClearing && (
            <InlineSpinner className="text-primary size-3.5" aria-label={t('ws_clear_all_btn')} />
          )}
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

      {view.lastError && (
        <p className="text-ql-11 text-destructive">{t(`ws_error_${view.lastError}`)}</p>
      )}

      {importedAt && (
        <p className="text-ql-11 text-muted-foreground">
          {t('ws_last_pull', { time: importedAt })}
        </p>
      )}

      {view.kind === 'google' && (
        <>
          <p className="text-ql-12 text-muted-foreground">{t('ws_google_drive_note')}</p>

          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-zinc-950/40 p-2">
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
