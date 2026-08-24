import {
  GOOGLE_WEB_SESSION_APPS,
  type GoogleWebSessionAppId
} from '@shared-core/constants/googleAiWebApps'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { GoogleAppIntegrationCard } from './components'

interface GoogleAppListProps {
  enabledAppIds: Set<GoogleWebSessionAppId>
  featureEnabled: boolean
  disableSessionMutations: boolean
  onToggleManagedApp: (appId: GoogleWebSessionAppId) => void
}

function GoogleAppList({
  enabledAppIds,
  featureEnabled,
  disableSessionMutations,
  onToggleManagedApp
}: GoogleAppListProps) {
  const { t } = useTranslation()

  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ql-11 text-foreground font-semibold">
            {t('gws_supported_apps_title')}
          </p>
          <span className="text-ql-12 text-muted-foreground">{t('gws_supported_apps_desc')}</span>
        </div>
        <p className="text-ql-12 text-muted-foreground leading-relaxed">
          {t('gws_supported_apps_hint')}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {GOOGLE_WEB_SESSION_APPS.map((app) => {
          const isEnabled = enabledAppIds.has(app.id)
          return (
            <GoogleAppIntegrationCard
              key={app.id}
              app={app}
              isEnabled={isEnabled}
              disabled={!featureEnabled || disableSessionMutations}
              onToggleManagedApp={onToggleManagedApp}
            />
          )
        })}
      </div>

      <p className="text-ql-12 text-muted-foreground mt-3 leading-relaxed">
        {t('gws_shared_account_note')}
      </p>
    </div>
  )
}

export default memo(GoogleAppList)
