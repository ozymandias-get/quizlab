import React, { useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Switch } from '@headlessui/react'
import { useAppTools, useLanguage, useToast } from '@app/providers'
import type { GeminiWebSessionActionResult } from '@shared-core/types'
import {
    DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS,
    GOOGLE_WEB_SESSION_APPS,
    type GoogleWebSessionAppId
} from '@shared-core/constants/google-ai-web-apps'
import { useLocalStorage } from '@shared/hooks'
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

    const managedApps = useMemo(
        () => GOOGLE_WEB_SESSION_APPS,
        []
    )
    const managedAppIds = useMemo(
        () => managedApps.map((app) => app.id),
        [managedApps]
    )
    const [enabledGoogleApps, setEnabledGoogleApps] = useLocalStorage<GoogleWebSessionAppId[]>(
        'gwsEnabledApps',
        DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS
    )

    const sharedOnlyApps = useMemo(
        () => GOOGLE_WEB_SESSION_APPS.filter((app) => !managedAppIds.includes(app.id)),
        [managedAppIds]
    )

    const enabledAppIds = useMemo(
        () => new Set(enabledGoogleApps.filter((appId) => managedAppIds.includes(appId))),
        [enabledGoogleApps, managedAppIds]
    )

    const reasonText = useMemo(() => {
        const reasonKey = `gws_reason_${webSessionStatus.reason}`
        const translated = t(reasonKey)
        return translated === reasonKey ? webSessionStatus.reason : translated
    }, [t, webSessionStatus.reason])

    const stateText = useMemo(() => {
        if (!webSessionStatus.featureEnabled) return t('gws_feature_disabled')
        if (!webSessionStatus.userEnabled) return t('gws_state_disabled')
        if (webSessionStatus.isAuthenticated) return t('gws_state_authenticated')
        if (webSessionStatus.needsReauth) return t('gws_state_reauth_required')
        if (webSessionStatus.isDegraded) return t('gws_state_degraded')
        return t('gws_state_auth_required')
    }, [t, webSessionStatus])

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
            // Errors are surfaced by the electron mutation helpers.
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

    const handleToggleManagedApp = useCallback(async (appId: GoogleWebSessionAppId) => {
        const nextEnabledAppIds = enabledAppIds.has(appId)
            ? managedApps.filter((app) => app.id !== appId && enabledAppIds.has(app.id)).map((app) => app.id)
            : managedApps.filter((app) => enabledAppIds.has(app.id) || app.id === appId).map((app) => app.id)

        setEnabledGoogleApps(nextEnabledAppIds)
    }, [enabledAppIds, managedApps, setEnabledGoogleApps])

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-5 sm:p-6 ${webSessionStatus.webEnabled
                    ? webSessionStatus.isAuthenticated
                        ? 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-green-500/10'
                        : webSessionStatus.needsReauth
                            ? 'border-rose-500/20 bg-gradient-to-r from-rose-500/10 to-red-500/10'
                            : 'border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10'
                    : 'border-white/10 bg-gradient-to-r from-slate-500/10 to-zinc-500/10'
                    }`}
            >
                <div className="flex flex-col gap-5">
                    <div className="flex items-start gap-3">
                        <div className={`rounded-xl p-2 ${webSessionStatus.isAuthenticated
                            ? 'bg-emerald-500/20'
                            : webSessionStatus.needsReauth
                                ? 'bg-rose-500/20'
                                : 'bg-amber-500/20'
                            }`}>
                            {webSessionStatus.checking ? (
                                <LoaderIcon className="h-5 w-5 text-white/40" />
                            ) : webSessionStatus.isAuthenticated ? (
                                <CheckIcon className="h-5 w-5 text-emerald-400" />
                            ) : webSessionStatus.needsReauth ? (
                                <XIcon className="h-5 w-5 text-rose-400" />
                            ) : (
                                <RefreshIcon className="h-5 w-5 text-amber-400" />
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-white/90">
                                        {t('gws_title')}
                                    </h4>
                                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                                        {stateText}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] text-white/55 backdrop-blur-sm lg:min-w-[260px]">
                                    <div>
                                        {t('gws_reason_prefix')}: <span className="text-white/78">{reasonText}</span>
                                    </div>
                                    {webSessionStatus.lastCheckAt && (
                                        <div className="mt-1 text-white/40">
                                            {t('gws_last_check')}: {new Date(webSessionStatus.lastCheckAt).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3.5 backdrop-blur-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <GeminiIcon className="h-4 w-4 text-white/80" />
                                    <span className="text-xs font-bold text-white/85">{t('gws_toggle_label')}</span>
                                </div>
                                <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                                    {t('gws_supported_apps_hint')}
                                </p>
                            </div>
                            <button
                                onClick={handleToggleWebEnabled}
                                disabled={!webSessionStatus.featureEnabled || isTogglingWebEnabled}
                                className={`relative h-6 w-11 shrink-0 rounded-full border transition-all disabled:opacity-50 ${webSessionStatus.userEnabled
                                    ? 'border-emerald-500/40 bg-emerald-500/20'
                                    : 'border-white/20 bg-white/10'
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
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur-sm">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                                    {t('gws_supported_apps_title')}
                                </p>
                                <span className="text-[11px] text-white/35">
                                    {t('gws_supported_apps_desc')}
                                </span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-white/42">
                                {t('gws_supported_apps_hint')}
                            </p>
                        </div>

                        <div className="mt-4 flex flex-col gap-3">
                            {managedApps.map((app) => {
                                const isEnabled = enabledAppIds.has(app.id)

                                return (
                                    <div
                                        key={app.id}
                                        className={`rounded-2xl border px-3 py-3 transition-all ${isEnabled
                                            ? 'border-white/12 bg-white/[0.05]'
                                            : 'border-white/8 bg-black/20'
                                            }`}
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div
                                                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10"
                                                    style={{ backgroundColor: `${app.color}22`, color: app.color }}
                                                >
                                                    {getAiIcon(app.icon) || <GeminiIcon className="h-5 w-5" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-white/90">{app.name}</p>
                                                    <p className="truncate text-[11px] text-white/45">{app.hostname}</p>
                                                    <p className={`mt-1 text-[10px] uppercase tracking-[0.18em] ${isEnabled ? 'text-emerald-300/70' : 'text-white/30'}`}>
                                                        {isEnabled ? t('gws_app_enabled') : t('gws_app_disabled')}
                                                    </p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={isEnabled}
                                                onChange={() => void handleToggleManagedApp(app.id)}
                                                disabled={!webSessionStatus.featureEnabled}
                                                className={`relative flex h-6 w-11 shrink-0 items-center rounded-full border p-1 transition-all disabled:opacity-50 ${isEnabled
                                                    ? 'border-emerald-500/35 bg-emerald-500/20'
                                                    : 'border-white/15 bg-white/10'
                                                    }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 rounded-full transition-all ${isEnabled
                                                        ? 'translate-x-5 bg-emerald-400'
                                                        : 'translate-x-0 bg-white/60'
                                                        }`}
                                                />
                                            </Switch>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                            {t('gws_shared_account_note')}
                        </p>

                        {sharedOnlyApps.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {sharedOnlyApps.map((app) => (
                                    <div
                                        key={app.id}
                                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/40"
                                    >
                                        <span style={{ color: app.color }}>
                                            {getAiIcon(app.icon) || <GeminiIcon className="h-3.5 w-3.5" />}
                                        </span>
                                        <span>{app.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                        <button
                            onClick={handleOpenWebLogin}
                            disabled={!webSessionStatus.webEnabled || isGeminiWebLoginInProgress}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-gray-800 shadow-lg transition-all hover:bg-gray-100 disabled:opacity-50"
                        >
                            {isGeminiWebLoginInProgress ? (
                                <LoaderIcon className="h-4 w-4 text-gray-600" />
                            ) : (
                                <GoogleIcon className="h-4 w-4" />
                            )}
                            {t('gws_login_btn')}
                        </button>

                        <button
                            onClick={handleCheckWebNow}
                            disabled={!webSessionStatus.webEnabled || isCheckingWebNow}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/20 disabled:opacity-50"
                        >
                            {isCheckingWebNow ? <LoaderIcon className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
                            {t('gws_check_now_btn')}
                        </button>

                        <button
                            onClick={handleReauthWeb}
                            disabled={!webSessionStatus.webEnabled || isReauthingWeb}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/20 px-4 py-2.5 text-sm font-bold text-amber-300 transition-all hover:bg-amber-500/30 disabled:opacity-50"
                        >
                            {isReauthingWeb ? <LoaderIcon className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
                            {t('gws_reauth_btn')}
                        </button>

                        <button
                            onClick={handleResetWebProfile}
                            disabled={!webSessionStatus.webEnabled || isResettingWebProfile}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2.5 text-sm font-bold text-red-300 transition-all hover:bg-red-500/30 disabled:opacity-50"
                        >
                            {isResettingWebProfile ? <LoaderIcon className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
                            {t('gws_reset_btn')}
                        </button>
                    </div>
                </div>
            </motion.div>

            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-rose-500/20 p-1.5">
                        <InfoIcon className="h-4 w-4 text-rose-300" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-rose-100/90">
                            {t('gws_warning_title')}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-rose-100/70">
                            {t('gws_warning_intro')}
                        </p>

                        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-rose-200/80">
                            {t('gws_risk_list_title')}
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                            {riskItems.map((item, index) => (
                                <p key={`risk-${index}`} className="text-xs leading-relaxed text-rose-100/70">
                                    {index + 1}. {item}
                                </p>
                            ))}
                        </div>

                        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-rose-200/80">
                            {t('gws_mitigation_title')}
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                            {mitigationItems.map((item, index) => (
                                <p key={`mitigation-${index}`} className="text-xs leading-relaxed text-rose-100/70">
                                    {index + 1}. {item}
                                </p>
                            ))}
                        </div>

                        <p className="mt-3 text-[11px] leading-relaxed text-rose-200/70">
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
