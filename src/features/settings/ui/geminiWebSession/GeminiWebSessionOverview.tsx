import type { GoogleWebSessionAppId } from '@shared-core/constants/googleAiWebApps'

import { Button } from '@app/components/ui/button'
import { SettingsSection } from '@shared/ui/components/primitives'
import { CheckIcon, GeminiIcon, LoaderIcon, RefreshIcon, XIcon } from '@ui/components/Icons'

import i18next from 'i18next'
import { motion } from 'motion/react'
import { memo, useCallback } from 'react'

import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'
import { ExtensionStatusCard, ExtensionWizardPanel } from './components'
import GeminiWebRiskNotice from './GeminiWebRiskNotice'
import GoogleAppList from './GoogleAppList'
import { getStatusIconClass } from './statusHelpers'
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
    return result ?? { success: false, error: t('error_unknown_error') }
  }, [installExtensionMutation, t])

  const handleWizardRemove = useCallback(async () => {
    const result = await removeExtensionMutation()
    return result ?? { success: false, error: t('error_unknown_error') }
  }, [removeExtensionMutation, t])

  const formatTimestamp = (value: string) =>
    new Date(value).toLocaleString(i18next.language === 'tr' ? 'tr-TR' : 'en-US')

  const statusGlyph =
    status.isRefreshing || status.checking ? (
      <LoaderIcon className="h-4 w-4 animate-spin" />
    ) : status.isAuthenticated ? (
      <CheckIcon className="h-4 w-4" />
    ) : status.needsReauth ? (
      <XIcon className="h-4 w-4" />
    ) : (
      <RefreshIcon className="h-4 w-4" />
    )

  const statusIconClass = status.checking && !status.isRefreshing ? '' : getStatusIconClass(status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4"
    >
      <SettingsSection
        icon={<span className={statusIconClass}>{statusGlyph}</span>}
        title={t('gws_title')}
        detail={stateText}
      >
        {status.isRefreshing && (
          <div className="border-primary/30 bg-primary/10 flex items-start gap-2.5 rounded-xl border p-3.5">
            <LoaderIcon className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-ql-12 text-foreground font-semibold">
                {t('gws_refreshing_inline')}
              </p>
              <p className="text-ql-12 text-muted-foreground mt-0.5 leading-relaxed">
                {t('gws_refreshing_inline_desc')}
              </p>
            </div>
          </div>
        )}

        {status.needsReauth && !status.isRefreshing && (
          <div className="border-destructive/30 bg-destructive/10 rounded-xl border p-3.5">
            <p className="text-ql-12 text-destructive font-semibold">
              {t('gws_reauth_alert_title')}
            </p>
            <p className="text-ql-12 text-muted-foreground mt-0.5 leading-relaxed">
              {t('gws_reauth_alert_body')}
            </p>
          </div>
        )}

        <div className="border-border/60 bg-background/40 flex flex-col gap-1.5 rounded-xl border p-4">
          <p className="text-ql-12 text-muted-foreground">
            {t('gws_reason_prefix')}:{' '}
            <span className="text-foreground font-medium">{reasonText}</span>
          </p>
          {status.lastCheckAt && (
            <p className="text-ql-12 text-muted-foreground">
              {t('gws_last_check')}: {formatTimestamp(status.lastCheckAt)}
            </p>
          )}
          {status.lastRefreshedAt && (
            <p className="text-ql-12 text-muted-foreground">
              {t('gws_last_refreshed')}: {formatTimestamp(status.lastRefreshedAt)}
            </p>
          )}
          {refreshReasonText && (
            <p className="text-ql-12 text-muted-foreground">
              {t('gws_last_refresh_reason')}: {refreshReasonText}
            </p>
          )}
        </div>

        <div className="border-border/60 bg-background/40 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <GeminiIcon className="text-foreground h-4 w-4 shrink-0" />
              <span className="text-ql-13 text-foreground font-semibold">
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
            className="shrink-0"
          />
        </div>

        <div className="flex justify-start">
          <Button
            type="button"
            variant="destructive-outline"
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
            <span className="text-ql-12 font-semibold">{t('gws_reset_btn')}</span>
          </Button>
        </div>
      </SettingsSection>

      <ExtensionStatusCard
        t={t}
        onInstallExtension={handlers.onInstallExtension}
        onRemoveExtension={handlers.onRemoveExtension}
      />

      <GeminiWebRiskNotice t={t} riskItems={riskItems} mitigationItems={mitigationItems} />

      <GoogleAppList
        enabledAppIds={enabledAppIds}
        featureEnabled={status.featureEnabled}
        disableSessionMutations={disableSessionMutations}
        onToggleManagedApp={handlers.onToggleManagedApp}
      />

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
