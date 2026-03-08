import { motion } from 'framer-motion'
import { Switch } from '@headlessui/react'
import {
    GOOGLE_WEB_SESSION_APPS,
    type GoogleWebSessionAppId
} from '@shared-core/constants/google-ai-web-apps'
import {
    CheckIcon,
    XIcon,
    LoaderIcon,
    GoogleIcon,
    RefreshIcon,
    GeminiIcon,
    getAiIcon
} from '@ui/components/Icons'
import type {
    GeminiWebSessionActionState,
    GeminiWebSessionHandlers,
    GeminiWebSessionStatusView
} from './types'

interface GeminiWebSessionOverviewProps {
    t: (key: string) => string
    status: GeminiWebSessionStatusView
    reasonText: string
    stateText: string
    enabledAppIds: Set<GoogleWebSessionAppId>
    actionState: GeminiWebSessionActionState
    handlers: GeminiWebSessionHandlers
}

const getCardClasses = (status: GeminiWebSessionStatusView) => {
    if (!status.webEnabled) {
        return 'border-white/10 bg-gradient-to-r from-slate-500/10 to-zinc-500/10'
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
    if (status.isAuthenticated) return 'bg-emerald-500/20'
    if (status.needsReauth) return 'bg-rose-500/20'
    return 'bg-amber-500/20'
}

function GeminiWebSessionOverview({
    t,
    status,
    reasonText,
    stateText,
    enabledAppIds,
    actionState,
    handlers
}: GeminiWebSessionOverviewProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-5 sm:p-6 ${getCardClasses(status)}`}
        >
            <div className="flex flex-col gap-5">
                <div className="flex items-start gap-3">
                    <div className={`rounded-xl p-2 ${getStatusIconContainerClass(status)}`}>
                        {status.checking ? (
                            <LoaderIcon className="h-5 w-5 text-white/40" />
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
                                <h4 className="text-sm font-bold text-white/90">{t('gws_title')}</h4>
                                <p className="mt-1 text-xs leading-relaxed text-white/60">{stateText}</p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] text-white/55 backdrop-blur-sm lg:min-w-[260px]">
                                <div>
                                    {t('gws_reason_prefix')}: <span className="text-white/78">{reasonText}</span>
                                </div>
                                {status.lastCheckAt && (
                                    <div className="mt-1 text-white/40">
                                        {t('gws_last_check')}: {new Date(status.lastCheckAt).toLocaleString()}
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
                            onClick={handlers.onToggleWebEnabled}
                            disabled={!status.featureEnabled || actionState.isTogglingWebEnabled}
                            className={`relative h-6 w-11 shrink-0 rounded-full border transition-all disabled:opacity-50 ${status.userEnabled
                                ? 'border-emerald-500/40 bg-emerald-500/20'
                                : 'border-white/20 bg-white/10'
                                }`}
                            aria-label={t('gws_toggle_label')}
                        >
                            <span
                                className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${status.userEnabled
                                    ? 'left-[22px] bg-emerald-400'
                                    : 'left-[3px] bg-white/60'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                    <button
                        onClick={handlers.onOpenWebLogin}
                        disabled={!status.webEnabled || actionState.isGeminiWebLoginInProgress}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-gray-800 shadow-lg transition-all hover:bg-gray-100 disabled:opacity-50"
                    >
                        {actionState.isGeminiWebLoginInProgress ? (
                            <LoaderIcon className="h-4 w-4 text-gray-600" />
                        ) : (
                            <GoogleIcon className="h-4 w-4" />
                        )}
                        {t('gws_login_btn')}
                    </button>

                    <button
                        onClick={handlers.onCheckWebNow}
                        disabled={!status.webEnabled || actionState.isCheckingWebNow}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/20 disabled:opacity-50"
                    >
                        {actionState.isCheckingWebNow ? <LoaderIcon className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
                        {t('gws_check_now_btn')}
                    </button>

                    <button
                        onClick={handlers.onReauthWeb}
                        disabled={!status.webEnabled || actionState.isReauthingWeb}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/20 px-4 py-2.5 text-sm font-bold text-amber-300 transition-all hover:bg-amber-500/30 disabled:opacity-50"
                    >
                        {actionState.isReauthingWeb ? <LoaderIcon className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
                        {t('gws_reauth_btn')}
                    </button>

                    <button
                        onClick={handlers.onResetWebProfile}
                        disabled={!status.webEnabled || actionState.isResettingWebProfile}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2.5 text-sm font-bold text-red-300 transition-all hover:bg-red-500/30 disabled:opacity-50"
                    >
                        {actionState.isResettingWebProfile ? <LoaderIcon className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
                        {t('gws_reset_btn')}
                    </button>
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
                        {GOOGLE_WEB_SESSION_APPS.map((app) => {
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
                                            onChange={() => handlers.onToggleManagedApp(app.id)}
                                            disabled={!status.featureEnabled}
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
                </div>
            </div>
        </motion.div>
    )
}

export default GeminiWebSessionOverview
