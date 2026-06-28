import {
  GOOGLE_WEB_SESSION_APPS,
  type GoogleWebSessionAppId
} from '@shared-core/constants/google-ai-web-apps'

import { CheckIcon, GeminiIcon, LoaderIcon, RefreshIcon, XIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { memo, useCallback } from 'react'

import { ExtensionStatusCard, ExtensionWizardDialog, GoogleAppIntegrationCard } from './components'
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

const getCardClasses = (status: GeminiWebSessionStatusView) => {
  if (!status.webEnabled) {
    return 'border-white/10 bg-gradient-to-r from-slate-500/10 to-zinc-500/10'
  }
  if (status.isRefreshing) {
    return 'border-sky-500/20 bg-gradient-to-r from-sky-500/10 to-cyan-500/10'
  }
  if (status.isAuthenticated) {
    return 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-green-500/10'
  }
  if (status.needsReauth) {
    return 'border-rose-500/20 bg-gradient-to-r from-rose-500/10 to-red-500/10'
  }
  return 'border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10'
}

const getStatusIconContainerClass = (status: GeminiWebSessionStatusView) => {
  if (status.isRefreshing) return 'bg-sky-500/20'
  if (status.isAuthenticated) return 'bg-emerald-500/20'
  if (status.needsReauth) return 'bg-rose-500/20'
  return 'bg-amber-500/20'
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
              <LoaderIcon className="h-5 w-5 animate-spin text-sky-300" />
            ) : status.checking ? (
              <LoaderIcon className="h-5 w-5 animate-spin text-white/40" />
            ) : status.isAuthenticated ? (
              <CheckIcon className="h-5 w-5 text-emerald-400" />
            ) : status.needsReauth ? (
              <XIcon className="h-5 w-5 text-rose-400" />
            ) : (
              <RefreshIcon className="h-5 w-5 text-amber-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h4 className="text-ql-14 font-bold text-white/90">{t('gws_title')}</h4>
                <p className="text-ql-12 mt-1 leading-relaxed text-white/60">{stateText}</p>
              </div>

              <div className="text-ql-12 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-white/55 backdrop-blur-sm lg:min-w-[260px]">
                <div>
                  {t('gws_reason_prefix')}: <span className="text-white/78">{reasonText}</span>
                </div>
                {status.lastCheckAt && (
                  <div className="mt-1 text-white/40">
                    {t('gws_last_check')}: {new Date(status.lastCheckAt).toLocaleString()}
                  </div>
                )}
                {status.lastRefreshedAt && (
                  <div className="mt-1 text-white/40">
                    {t('gws_last_refreshed')}: {new Date(status.lastRefreshedAt).toLocaleString()}
                  </div>
                )}
                {refreshReasonText && (
                  <div className="mt-1 text-white/40">
                    {t('gws_last_refresh_reason')}: {refreshReasonText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {status.isRefreshing && (
          <div className="text-ql-12 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3.5 py-3 text-sky-100">
            <div className="flex items-center gap-2 font-semibold">
              <LoaderIcon className="h-4 w-4 animate-spin" />
              <span>{t('gws_refreshing_inline')}</span>
            </div>
            <p className="text-ql-12 mt-1 leading-relaxed text-sky-100/75">
              {t('gws_refreshing_inline_desc')}
            </p>
          </div>
        )}

        {status.needsReauth && !status.isRefreshing && (
          <div className="text-ql-12 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-3 text-rose-50">
            <div className="font-semibold">{t('gws_reauth_alert_title')}</div>
            <p className="text-ql-12 mt-1 leading-relaxed text-rose-100/80">
              {t('gws_reauth_alert_body')}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/10 p-3.5 backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <GeminiIcon className="h-4 w-4 text-white/80" />
                <span className="text-ql-12 font-bold text-white/85">{t('gws_toggle_label')}</span>
              </div>
              <p className="text-ql-12 mt-1 leading-relaxed text-white/45">
                {t('gws_supported_apps_hint')}
              </p>
            </div>
            <button
              type="button"
              onClick={handlers.onToggleWebEnabled}
              disabled={!status.featureEnabled || disableSessionMutations}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
                status.userEnabled
                  ? 'border-emerald-500/40 bg-emerald-500/20'
                  : 'border-white/20 bg-white/10'
              }`}
              aria-label={t('gws_toggle_label')}
            >
              <span
                className={`absolute top-[3px] h-4 w-4 rounded-full transition-colors ${
                  status.userEnabled ? 'left-[22px] bg-emerald-400' : 'left-[3px] bg-white/60'
                }`}
              />
            </button>
          </div>
        </div>

        <ExtensionStatusCard
          t={t}
          onInstallExtension={handlers.onInstallExtension}
          onRemoveExtension={handlers.onRemoveExtension}
        />

        <div className="flex justify-start">
          <button
            type="button"
            onClick={handlers.onResetWebProfile}
            disabled={!status.webEnabled || disableSessionMutations}
            className="text-ql-12 inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2.5 font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:opacity-50"
          >
            {actionState.isResettingWebProfile || status.isRefreshing ? (
              <LoaderIcon className="h-4 w-4 animate-spin" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
            {t('gws_reset_btn')}
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-ql-11 tracking-ql-fine font-semibold text-white/55">
                {t('gws_supported_apps_title')}
              </p>
              <span className="text-ql-12 text-white/35">{t('gws_supported_apps_desc')}</span>
            </div>
            <p className="text-ql-12 leading-relaxed text-white/42">
              {t('gws_supported_apps_hint')}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {GOOGLE_WEB_SESSION_APPS.map((app) => {
              const isEnabled = enabledAppIds.has(app.id)

              return (
                <GoogleAppIntegrationCard
                  key={app.id}
                  app={app}
                  isEnabled={isEnabled}
                  disabled={!status.featureEnabled || disableSessionMutations}
                  onToggleManagedApp={handlers.onToggleManagedApp}
                />
              )
            })}
          </div>

          <p className="text-ql-12 mt-3 leading-relaxed text-white/40">
            {t('gws_shared_account_note')}
          </p>
        </div>
      </div>

      {wizardOpen && wizardMode && (
        <ExtensionWizardDialog
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
