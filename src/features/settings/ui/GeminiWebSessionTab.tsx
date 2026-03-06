import React, { useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAppTools, useLanguage, useToast } from '@app/providers'
import type { GeminiWebSessionActionResult } from '@shared-core/types'
import { GOOGLE_WEB_SESSION_APPS } from '@shared-core/constants/google-ai-web-apps'
import {
    useGeminiWebStatus,
    useGeminiWebCheckNow,
    useGeminiWebReauth,
    useGeminiWebResetProfile,
    useGeminiWebSetEnabled
} from '@platform/electron/api/useGeminiWebSessionApi'
import {
    CheckIcon,
    XIcon,
    LoaderIcon,
    GoogleIcon,
    RefreshIcon,
    GeminiIcon,
    InfoIcon,
    getAiIcon
} from '@ui/components/Icons'

/**
 * Gemini Web Session Settings Tab
 * Manages persistent web session status and reauth operations.
 */
const GeminiWebSessionTab = React.memo(() => {
    const { t } = useLanguage()
    const { showError } = useToast()

    const {
        data: webSessionData,
        isLoading: isWebSessionLoading,
        isRefetching: isWebSessionRefetching,
        refetch: refetchWebSession
    } = useGeminiWebStatus({
        refetchInterval: (query) => {
            const state = query.state.data?.state
            const available = query.state.data?.featureEnabled
            const enabled = query.state.data?.enabled
            if (!available || !enabled) return false
            if (state === 'authenticated') return false
            return 60_000
        }
    })

    const { isGeminiWebLoginInProgress, startGeminiWebLogin } = useAppTools()
    const { mutateAsync: checkWebNow, isPending: isCheckingWebNow } = useGeminiWebCheckNow()
    const { mutateAsync: reauthWeb, isPending: isReauthingWeb } = useGeminiWebReauth()
    const { mutateAsync: resetWebProfile, isPending: isResettingWebProfile } = useGeminiWebResetProfile()
    const { mutateAsync: setWebEnabled, isPending: isTogglingWebEnabled } = useGeminiWebSetEnabled()

    const webSessionStatus = useMemo(() => {
        const state = webSessionData?.state || 'uninitialized'
        const reason = webSessionData?.reasonCode || 'none'
        const checking = isWebSessionLoading || isWebSessionRefetching || isCheckingWebNow
        const featureEnabled = !!webSessionData?.featureEnabled
        const userEnabled = !!webSessionData?.enabled
        const webEnabled = featureEnabled && userEnabled
        const isAuthenticated = state === 'authenticated'
        const needsReauth = state === 'reauth_required'
        const isDegraded = state === 'degraded'

        return {
            state,
            reason,
            checking,
            featureEnabled,
            userEnabled,
            webEnabled,
            isAuthenticated,
            needsReauth,
            isDegraded,
            lastCheckAt: webSessionData?.lastCheckAt || null
        }
    }, [webSessionData, isWebSessionLoading, isWebSessionRefetching, isCheckingWebNow])

    const riskItems = useMemo(() => ([
        t('gws_risk_unofficial'),
        t('gws_risk_challenge'),
        t('gws_risk_expiry'),
        t('gws_risk_profile_access'),
        t('gws_risk_behavior_changes'),
        t('gws_risk_multi_device')
    ]), [t])

    const mitigationItems = useMemo(() => ([
        t('gws_mitigation_dedicated_profile'),
        t('gws_mitigation_stable_network'),
        t('gws_mitigation_manual_reauth'),
        t('gws_mitigation_no_shared_machine')
    ]), [t])

    const supportedApps = useMemo(() => GOOGLE_WEB_SESSION_APPS, [])

    const reasonText = useMemo(() => {
        const reasonKey = `gws_reason_${webSessionStatus.reason}`
        const translated = t(reasonKey)
        return translated === reasonKey ? webSessionStatus.reason : translated
    }, [t, webSessionStatus.reason])

    const runSessionAction = useCallback(async (
        action: () => Promise<GeminiWebSessionActionResult>,
        options?: { refetch?: boolean }
    ) => {
        try {
            const result = await action()
            if (!result?.success && result?.error) {
                showError(result.error)
            }
            if (options?.refetch) {
                await refetchWebSession()
            }
        } catch {
            // Error already shown via toast in useElectronMutation
        }
    }, [refetchWebSession, showError])

    const handleOpenWebLogin = useCallback(
        () => runSessionAction(startGeminiWebLogin),
        [runSessionAction, startGeminiWebLogin]
    )

    const handleCheckWebNow = useCallback(
        () => runSessionAction(checkWebNow, { refetch: true }),
        [checkWebNow, runSessionAction]
    )

    const handleReauthWeb = useCallback(
        () => runSessionAction(reauthWeb),
        [reauthWeb, runSessionAction]
    )

    const handleResetWebProfile = useCallback(
        () => runSessionAction(resetWebProfile),
        [resetWebProfile, runSessionAction]
    )

    const handleToggleWebEnabled = useCallback(async () => {
        await runSessionAction(() => setWebEnabled(!webSessionStatus.userEnabled))
    }, [runSessionAction, setWebEnabled, webSessionStatus.userEnabled])

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border ${webSessionStatus.webEnabled
                    ? webSessionStatus.isAuthenticated
                        ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/20'
                        : webSessionStatus.needsReauth
                            ? 'bg-gradient-to-r from-rose-500/10 to-red-500/10 border-rose-500/20'
                            : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20'
                    : 'bg-gradient-to-r from-slate-500/10 to-zinc-500/10 border-white/10'
                    }`}
            >
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl ${webSessionStatus.isAuthenticated
                        ? 'bg-emerald-500/20'
                        : webSessionStatus.needsReauth
                            ? 'bg-rose-500/20'
                            : 'bg-amber-500/20'
                        }`}>
                        {webSessionStatus.checking ? (
                            <LoaderIcon className="w-5 h-5 text-white/40" />
                        ) : webSessionStatus.isAuthenticated ? (
                            <CheckIcon className="w-5 h-5 text-emerald-400" />
                        ) : webSessionStatus.needsReauth ? (
                            <XIcon className="w-5 h-5 text-rose-400" />
                        ) : (
                            <RefreshIcon className="w-5 h-5 text-amber-400" />
                        )}
                    </div>

                    <div className="flex-1">
                        <h4 className="text-sm font-bold mb-1 text-white/90">
                            {t('gws_title')}
                        </h4>
                        <p className="text-xs text-white/60 leading-relaxed">
                            {!webSessionStatus.featureEnabled
                                ? t('gws_feature_disabled')
                                : !webSessionStatus.userEnabled
                                    ? t('gws_state_disabled')
                                    : webSessionStatus.isAuthenticated
                                        ? t('gws_state_authenticated')
                                        : webSessionStatus.needsReauth
                                            ? t('gws_state_reauth_required')
                                            : webSessionStatus.isDegraded
                                                ? t('gws_state_degraded')
                                                : t('gws_state_auth_required')
                            }
                        </p>

                        {webSessionStatus.featureEnabled && (
                            <p className="text-[11px] text-white/40 mt-1">
                                {t('gws_reason_prefix')}: <span>{reasonText}</span>
                                {webSessionStatus.lastCheckAt ? ` · ${t('gws_last_check')}: ${new Date(webSessionStatus.lastCheckAt).toLocaleString()}` : ''}
                            </p>
                        )}

                        <div className="flex items-center justify-between mt-3 p-2.5 rounded-xl border border-white/10 bg-white/5">
                            <div className="flex items-center gap-2">
                                <GeminiIcon className="w-4 h-4 text-white/80" />
                                <span className="text-xs font-bold text-white/85">{t('gws_toggle_label')}</span>
                            </div>
                            <button
                                onClick={handleToggleWebEnabled}
                                disabled={!webSessionStatus.featureEnabled || isTogglingWebEnabled}
                                className={`relative h-6 w-11 rounded-full transition-all border disabled:opacity-50 ${webSessionStatus.userEnabled
                                    ? 'bg-emerald-500/20 border-emerald-500/40'
                                    : 'bg-white/10 border-white/20'
                                    }`}
                                aria-label={t('gws_toggle_label')}
                            >
                                <span
                                    className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${webSessionStatus.userEnabled
                                        ? 'left-[22px] bg-emerald-400'
                                        : 'left-[3px] bg-white/60'
                                        }`}
                                />
                            </button>
                        </div>

                        <div className="mt-4">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                                    {t('gws_supported_apps_title')}
                                </p>
                                <span className="text-[11px] text-white/35">
                                    {t('gws_supported_apps_desc')}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2.5">
                                {supportedApps.map((app) => (
                                    <div
                                        key={app.id}
                                        className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10"
                                                style={{ backgroundColor: `${app.color}22`, color: app.color }}
                                            >
                                                {getAiIcon(app.icon) || <GeminiIcon className="w-5 h-5" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-white/90 truncate">{app.name}</p>
                                                <p className="text-[11px] text-white/45 truncate">{app.hostname}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-2 text-[11px] text-white/40 leading-relaxed">
                                {t('gws_shared_account_note')}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <button
                                onClick={handleOpenWebLogin}
                                disabled={!webSessionStatus.webEnabled || isGeminiWebLoginInProgress}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
                                    bg-white text-gray-800 hover:bg-gray-100 transition-all disabled:opacity-50 shadow-lg"
                            >
                                {isGeminiWebLoginInProgress ? (
                                    <LoaderIcon className="w-4 h-4 text-gray-600" />
                                ) : (
                                    <GoogleIcon className="w-4 h-4" />
                                )}
                                {t('gws_login_btn')}
                            </button>

                            <button
                                onClick={handleCheckWebNow}
                                disabled={!webSessionStatus.webEnabled || isCheckingWebNow}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
                                    bg-white/10 text-white/80 hover:bg-white/20 transition-all disabled:opacity-50"
                            >
                                {isCheckingWebNow ? <LoaderIcon className="w-4 h-4" /> : <RefreshIcon className="w-4 h-4" />}
                                {t('gws_check_now_btn')}
                            </button>

                            <button
                                onClick={handleReauthWeb}
                                disabled={!webSessionStatus.webEnabled || isReauthingWeb}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
                                    bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30
                                    transition-all disabled:opacity-50"
                            >
                                {isReauthingWeb ? <LoaderIcon className="w-4 h-4" /> : <RefreshIcon className="w-4 h-4" />}
                                {t('gws_reauth_btn')}
                            </button>

                            <button
                                onClick={handleResetWebProfile}
                                disabled={!webSessionStatus.webEnabled || isResettingWebProfile}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
                                    bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30
                                    transition-all disabled:opacity-50"
                            >
                                {isResettingWebProfile ? <LoaderIcon className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                                {t('gws_reset_btn')}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-rose-500/20">
                        <InfoIcon className="w-4 h-4 text-rose-300" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-rose-100/90">
                            {t('gws_warning_title')}
                        </p>
                        <p className="text-xs text-rose-100/70 leading-relaxed mt-1">
                            {t('gws_warning_intro')}
                        </p>

                        <p className="text-[11px] font-bold uppercase tracking-wider text-rose-200/80 mt-3">
                            {t('gws_risk_list_title')}
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                            {riskItems.map((item, index) => (
                                <p key={`risk-${index}`} className="text-xs text-rose-100/70 leading-relaxed">
                                    {index + 1}. {item}
                                </p>
                            ))}
                        </div>

                        <p className="text-[11px] font-bold uppercase tracking-wider text-rose-200/80 mt-3">
                            {t('gws_mitigation_title')}
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                            {mitigationItems.map((item, index) => (
                                <p key={`mitigation-${index}`} className="text-xs text-rose-100/70 leading-relaxed">
                                    {index + 1}. {item}
                                </p>
                            ))}
                        </div>

                        <p className="text-[11px] text-rose-200/70 leading-relaxed mt-3">
                            <strong>{t('gcli_note')}</strong> {t('gws_official_warning')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
})

GeminiWebSessionTab.displayName = 'GeminiWebSessionTab'

export default GeminiWebSessionTab
