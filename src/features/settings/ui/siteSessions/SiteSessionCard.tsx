import { GOOGLE_WEB_SESSION_APPS } from '@shared-core/constants/googleAiWebApps'

import i18next from 'i18next'
import { memo } from 'react'

import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'
import type { SiteSessionCardProps } from './types'

/**
 * The names of the apps a row covers.
 *
 * Only the Google row has more than one: the Google apps share one account
 * and therefore one row. The ids come from the main process, so they are
 * resolved against the app definitions; an unknown id keeps its raw form
 * instead of disappearing from the card.
 */
function memberAppNames(memberAppIds: string[]): string[] {
  return memberAppIds.map(
    (memberAppId) =>
      GOOGLE_WEB_SESSION_APPS.find((app) => app.id === memberAppId)?.name ?? memberAppId
  )
}

/**
 * One site: its name, its host, what the session looks like right now and the
 * switch that pulls the login from Chrome.
 */
function SiteSessionCard({ view, disabled, onToggle, t }: SiteSessionCardProps) {
  // A custom site id carries a colon, which is legal in an id but awkward in
  // a selector, so the id is flattened for the label that names the switch.
  const idBase = `site-session-${view.siteId.replaceAll(/[^a-zA-Z0-9_-]/g, '-')}`
  const switchId = `${idBase}-switch`
  const hostId = `${idBase}-host`
  const memberNames = view.kind === 'google' ? memberAppNames(view.memberAppIds) : []
  const importedAt =
    view.status === 'imported' && view.importedAt
      ? new Date(view.importedAt).toLocaleString(i18next.language === 'tr' ? 'tr-TR' : 'en-US')
      : null

  return (
    <div className="border-border/60 bg-background/40 flex flex-col gap-2.5 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ql-13 text-foreground font-semibold">{t(view.labelKey)}</p>
          <p id={hostId} className="text-ql-11 text-muted-foreground mt-0.5">
            {view.hostname}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label htmlFor={switchId} className="text-ql-11 text-muted-foreground">
            {t('ws_toggle_label')}
          </label>
          <SettingsToggleSwitch
            id={switchId}
            aria-describedby={hostId}
            checked={view.enabled}
            onChange={() => onToggle(view.siteId)}
            disabled={disabled}
            className="shrink-0"
          />
        </div>
      </div>

      <p className="text-ql-12 text-muted-foreground">{t(`ws_status_${view.status}`)}</p>

      {importedAt && (
        <p className="text-ql-11 text-muted-foreground">
          {t('ws_last_pull', { time: importedAt })}
        </p>
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
