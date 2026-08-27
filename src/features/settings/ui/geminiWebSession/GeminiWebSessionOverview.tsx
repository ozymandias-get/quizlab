import type { GoogleWebSessionAppId } from '@shared-core/constants/googleAiWebApps'

import { Button } from '@app/components/ui/button'
import { SurfaceCard } from '@shared/ui/components/primitives'
import { CheckIcon, GeminiIcon, LoaderIcon, RefreshIcon, XIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { memo, useCallback } from 'react'

import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'
import { ExtensionStatusCard, ExtensionWizardPanel } from './components'
import GeminiWebRiskNotice from './GeminiWebRiskNotice'
import GoogleAppList from './GoogleAppList'
import { getCardClasses, getStatusIconContainerClass } from './statusHelpers'
import type {
  GeminiWebSessionActionState,
  GeminiWebSessionHandlers,
  GeminiWebSessionStatusView
} from './types'

interface GeminiWebSessionOverviewProps {
  t: (key: string) => string
  status: GeminiWebSessionStatusView
  reasonText: string
  refreshReasonText?: string | null
  stateText: string
  enabledAppIds: Set<GoogleWebSessionAppId>
  actionState: GeminiWebSessionActionState
  handlers: GeminiWebSessionHandlers
  wizardOpen: boolean
  wizardMode: 'install' | 'remove' | null
  riskItems: string[]
  mitigationItems: string[]
  closeWizard: () => void
  installExtensionMutation: () => Promise<{
    success: boolean
    installedPath?: string
    error?: string
  } | null>
  removeExtensionMutation: () => Promise<{ success: boolean; error?: string } | null>
}

function GeminiWebSessionOverview({
  t,
  status,
  reasonText,
  refreshReasonText,
  stateText,
  enabledAppIds,
  actionState,
  handlers,
  wizardOpen,
  wizardMode,
  riskItems,
  mitigationItems,
  closeWizard,
  installExtensionMutation,
  removeExtensionMutation
}: GeminiWebSessionOverviewProps) {
  const disableSessionMutations =
    status.isRefreshing || actionState.isResettingWebProfile || actionState.isTogglingWebEnabled

  const handleWizardInstall = useCallback(async () => {
    const result = await installExtensionMutation()
    return result ?? { success: false, error: 'Unknown error' }
  }, [installExtensionMutation])

  const handleWizardRemove = useCallback(async () => {
    const result = await removeExtensionMutation()
    return result ?? { success: false, error: 'Unknown error' }
  }, [removeExtensionMutation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 sm:p-6 ${getCardClasses(status)}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2 ${getStatusIconContainerClass(status)}`}>
            {status.isRefreshing ? (
              <LoaderIcon className="text-primary h-5 w-5 animate-spin" />
            ) : status.checking ? (
              <LoaderIcon className="text-muted-foreground h-5 w-5 animate-spin" />
            ) : status.isAuthenticated ? (
              <CheckIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : status.needsReauth ? (
              <XIcon className="text-destructive h-5 w-5" />
            ) : (
              <RefreshIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h4 className="text-ql-13 text-foreground font-bold">{t('gws_title')}</h4>
                <p className="text-ql-12 text-muted-foreground mt-1 leading-relaxed">{stateText}</p>
              </div>

              <div className="text-ql-12 border-border bg-muted/40 text-muted-foreground rounded-xl border px-3 py-2 shadow-xs lg:min-w-[260px]">
                <div>
                  {t('gws_reason_prefix')}:{' '}
                  <span className="text-foreground font-medium">{reasonText}</span>
                </div>
                {status.lastCheckAt && (
                  <div className="text-muted-foreground mt-1">
                    {t('gws_last_check')}: {new Date(status.lastCheckAt).toLocaleString()}
                  </div>
                )}
                {status.lastRefreshedAt && (
                  <div className="text-muted-foreground mt-1">
                    {t('gws_last_refreshed')}: {new Date(status.lastRefreshedAt).toLocaleString()}
                  </div>
                )}
                {refreshReasonText && (
                  <div className="text-muted-foreground mt-1">
                    {t('gws_last_refresh_reason')}: {refreshReasonText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {status.isRefreshing && (
          <div className="text-ql-12 border-primary/30 bg-primary/10 text-primary rounded-xl border px-3.5 py-3">
            <div className="flex items-center gap-2 font-semibold">
              <LoaderIcon className="h-4 w-4 animate-spin" />
              <span>{t('gws_refreshing_inline')}</span>
            </div>
            <p className="text-ql-12 text-primary/80 mt-1 leading-relaxed">
              {t('gws_refreshing_inline_desc')}
            </p>
          </div>
        )}

        {status.needsReauth && !status.isRefreshing && (
          <div className="text-ql-12 border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-3.5 py-3">
            <div className="font-semibold">{t('gws_reauth_alert_title')}</div>
            <p className="text-ql-12 text-destructive/80 mt-1 leading-relaxed">
              {t('gws_reauth_alert_body')}
            </p>
          </div>
        )}

        <SurfaceCard className="rounded-xl p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <GeminiIcon className="text-foreground h-4 w-4" />
                <span className="text-ql-12 text-foreground font-bold">
                  {t('gws_toggle_label')}
                </span>
              </div>
              <p className="text-ql-12 text-muted-foreground mt-1 leading-relaxed">
                {t('gws_supported_apps_hint')}
              </p>
            </div>
            <SettingsToggleSwitch
              checked={status.userEnabled}
              onChange={handlers.onToggleWebEnabled}
              disabled={!status.featureEnabled || disableSessionMutations}
            />
          </div>
        </SurfaceCard>

        <ExtensionStatusCard
          t={t}
          onInstallExtension={handlers.onInstallExtension}
          onRemoveExtension={handlers.onRemoveExtension}
        />

        <GeminiWebRiskNotice t={t} riskItems={riskItems} mitigationItems={mitigationItems} />

        <div className="flex justify-start">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handlers.onResetWebProfile}
            disabled={!status.webEnabled || disableSessionMutations}
            className="gap-2"
          >
            {actionState.isResettingWebProfile || status.isRefreshing ? (
              <LoaderIcon className="h-4 w-4 animate-spin" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
            <span>{t('gws_reset_btn')}</span>
          </Button>
        </div>

        <GoogleAppList
          enabledAppIds={enabledAppIds}
          featureEnabled={status.featureEnabled}
          disableSessionMutations={disableSessionMutations}
          onToggleManagedApp={handlers.onToggleManagedApp}
        />
      </div>

      {wizardOpen && wizardMode && (
        <ExtensionWizardPanel
          open={wizardOpen}
          mode={wizardMode}
          riskItems={riskItems}
          mitigationItems={mitigationItems}
          installedPath={null}
          onInstall={handleWizardInstall}
          onRemove={handleWizardRemove}
          onClose={closeWizard}
        />
      )}
    </motion.div>
  )
}

export default memo(GeminiWebSessionOverview)
