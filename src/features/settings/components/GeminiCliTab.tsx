import React, { useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { Query } from '@tanstack/react-query'
import { useLanguage, useToast } from '@src/app/providers'
import { useCheckAuth, useCliPath, useOpenLogin, useLogout } from '@platform/electron/api/useQuizApi'
import { useOpenExternal } from '@platform/electron/api/useSystemApi'
import { TerminalIcon, CheckIcon, XIcon, LoaderIcon, ExternalLinkIcon, GoogleIcon, RefreshIcon } from '@src/components/ui/Icons'
import type { QuizAuthResult } from '@shared/types'

// Icons imported from @src/components/ui/Icons

/**
 * Gemini CLI Settings Tab
 * Shows CLI status, auth status and allows model selection
 */
const GeminiCliTab = React.memo(() => {
    const { t } = useLanguage()
    const { showError } = useToast()

    const { data: cliStatus, isLoading: isCliLoading } = useCliPath()

    // Auth Check with polling every 3s when not authenticated
    const {
        data: authData,
        isLoading: isAuthLoading,
        isRefetching: isAuthChecking,
        refetch: refreshAuth
    } = useCheckAuth({
        refetchInterval: (query: Query<QuizAuthResult, Error>) =>
            !query.state.data?.authenticated ? 3000 : false
    })

    const { mutateAsync: openLogin, isPending: isOpeningLogin } = useOpenLogin()
    const { mutateAsync: logout, isPending: isLoggingOut } = useLogout()
    const { mutate: openExternal } = useOpenExternal()

    // Derived State
    const authStatus = useMemo(() => ({
        authenticated: !!authData?.authenticated,
        checking: isAuthLoading || isAuthChecking,
        account: authData?.account
    }), [authData, isAuthLoading, isAuthChecking])

    // Open login terminal
    const handleOpenLogin = useCallback(async () => {
        try {
            const result = await openLogin()
            if (!result?.success && result?.error) {
                showError(result.error)
            }
        } catch {
            // Error already shown via toast in useElectronMutation
        }
    }, [openLogin, showError])

    // Refresh auth status
    const handleRefreshAuth = useCallback(() => {
        refreshAuth()
    }, [refreshAuth])

    // Logout
    const handleLogout = useCallback(async () => {
        try {
            await logout()
        } catch {
            // Error already shown via toast in useElectronMutation
        }
    }, [logout])

    // Open Gemini CLI docs via React Query mutation
    const openCliDocs = useCallback(() => {
        openExternal('https://github.com/google-gemini/gemini-cli')
    }, [openExternal])

    if (isCliLoading && !cliStatus) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoaderIcon className="w-6 h-6 text-white/40" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Auth Status Banner */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border ${authStatus.authenticated
                    ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/20'
                    : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20'
                    }`}
            >
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl ${authStatus.authenticated ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                        {authStatus.checking ? (
                            <LoaderIcon className="w-5 h-5 text-white/40" />
                        ) : authStatus.authenticated ? (
                            <CheckIcon className="w-5 h-5 text-emerald-400" />
                        ) : (
                            <XIcon className="w-5 h-5 text-amber-400" />
                        )}
                    </div>
                    <div className="flex-1">
                        <h4 className={`text-sm font-bold mb-1 ${authStatus.authenticated ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {authStatus.authenticated ? t('gcli_account_connected') : t('gcli_login_required')}
                        </h4>
                        <p className="text-xs text-white/50 leading-relaxed">
                            {authStatus.authenticated
                                ? t('gcli_ready_desc')
                                : t('gcli_login_desc')
                            }
                        </p>

                        <div className="flex items-center gap-2 mt-3">
                            {!authStatus.authenticated && (
                                <button
                                    onClick={handleOpenLogin}
                                    disabled={isOpeningLogin}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
                                        bg-white text-gray-800 hover:bg-gray-100 transition-all
                                        disabled:opacity-50 shadow-lg"
                                >
                                    {isOpeningLogin ? (
                                        <LoaderIcon className="w-4 h-4 text-gray-600" />
                                    ) : (
                                        <GoogleIcon className="w-4 h-4" />
                                    )}
                                    {t('gcli_login_btn')}
                                </button>
                            )}
                            {authStatus.authenticated && (
                                <button
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
                                        bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30
                                        transition-all disabled:opacity-50"
                                >
                                    {isLoggingOut ? (
                                        <LoaderIcon className="w-4 h-4" />
                                    ) : (
                                        <XIcon className="w-4 h-4" />
                                    )}
                                    {t('gcli_logout_btn')}
                                </button>
                            )}
                            <button
                                onClick={handleRefreshAuth}
                                disabled={authStatus.checking}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                                    bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
                            >
                                <RefreshIcon className={`w-3.5 h-3.5 ${authStatus.checking ? 'animate-spin' : ''}`} />
                                {t('gcli_check_status')}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Usage Instructions */}
            <div className="space-y-4 mb-6">
                <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider px-1">{t('gcli_how_to_use')}</h3>

                <div className="grid gap-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 h-fit">
                            <TerminalIcon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-white/90">{t('gcli_step1_title')}</h4>
                            <p className="text-xs text-white/60 leading-relaxed">
                                {t('gcli_step1_desc')}
                            </p>
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 h-fit">
                            <CheckIcon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-white/90">{t('gcli_step2_title')}</h4>
                            <p className="text-xs text-white/60 leading-relaxed">
                                {t('gcli_step2_desc')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Connected Account Info */}
            {authStatus.authenticated && authStatus.account && authStatus.account !== 'Google OAuth' && (
                <div className="space-y-2 mb-6">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">
                        {t('gcli_connected_account')}
                    </label>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <div className="p-2 rounded-full bg-white flex items-center justify-center">
                            <GoogleIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white/90 truncate">
                                {authStatus.account}
                            </p>
                            <p className="text-xs text-emerald-400/60">
                                {t('gcli_active_session')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Note */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-blue-500/20">
                        <TerminalIcon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs text-blue-200/80 leading-relaxed">
                            <strong>{t('gcli_note')}</strong> {t('gcli_note_desc')}
                        </p>
                        <button
                            onClick={openCliDocs}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            {t('gcli_about_btn')}
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
})

GeminiCliTab.displayName = 'GeminiCliTab'

export default GeminiCliTab


