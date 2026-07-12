import {
  GOOGLE_WEB_SESSION_APPS,
  type GoogleWebSessionAppId
} from '@shared-core/constants/google-ai-web-apps'

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
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur-sm">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ql-11 tracking-ql-fine font-semibold text-white/55">
            {t('gws_supported_apps_title')}
          </p>
          <span className="text-ql-12 text-white/35">{t('gws_supported_apps_desc')}</span>
        </div>
        <p className="text-ql-12 leading-relaxed text-white/42">{t('gws_supported_apps_hint')}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
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

      <p className="text-ql-12 mt-3 leading-relaxed text-white/40">
        {t('gws_shared_account_note')}
      </p>
    </div>
  )
}

export default memo(GoogleAppList)
