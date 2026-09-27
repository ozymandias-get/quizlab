import {
  GOOGLE_WEB_SESSION_APPS,
  type GoogleWebSessionAppId
} from '@shared-core/constants/googleAiWebApps'

import { SettingsSection } from '@shared/ui/components/primitives'
import { GlobeIcon } from '@ui/components/Icons'

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
    <SettingsSection
      icon={<GlobeIcon className="h-4 w-4" />}
      title={t('gws_supported_apps_title')}
      detail={t('gws_supported_apps_hint')}
      action={
        <span className="bg-muted text-muted-foreground text-ql-11 shrink-0 rounded-full px-2.5 py-1 font-medium">
          {t('gws_supported_apps_desc')}
        </span>
      }
    >
      <div className="flex flex-col gap-2.5">
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

      <p className="text-ql-12 text-muted-foreground leading-relaxed">
        {t('gws_shared_account_note')}
      </p>
    </SettingsSection>
  )
}

export default memo(GoogleAppList)
