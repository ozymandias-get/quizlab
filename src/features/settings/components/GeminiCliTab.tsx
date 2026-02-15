import React, { useState, useEffect, useCallback } from 'react'
import { Logger } from '@src/utils/logger'
import { motion } from 'framer-motion'
import { useLanguage, useToast } from '@src/app/providers'
import { TerminalIcon, CheckIcon, XIcon, LoaderIcon, ExternalLinkIcon, GoogleIcon, RefreshIcon } from '@src/components/ui/Icons'
import type { QuizAuthResult, QuizCliPathResult, QuizActionResult } from '@shared/types'

interface CliStatus {
    path: string;
    exists: boolean;
}

interface AuthStatus {
    authenticated: boolean;
    checking: boolean;
    account?: string | null;
}

// Icons imported from @src/components/ui/Icons

/**
 * Gemini CLI Settings Tab
 * Shows CLI status, auth status and allows model selection
 */
const GeminiCliTab = React.memo(() => {
    const { t } = useLanguage()
    const { showSuccess, showWarning, showError } = useToast()

    // cliStatus is set but not used in UI, keeping for potential future use
    const [, setCliStatus] = useState<CliStatus>({ path: '', exists: false })
    const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false, checking: true })
    const [isLoading, setIsLoading] = useState(true)
    const [isOpeningLogin, setIsOpeningLogin] = useState(false)

    // Prevent state updates on unmount
    const isMountedRef = React.useRef(true)
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    // Load settings and check auth
    const loadStatus = useCallback(async () => {
        try {
            // Check CLI path
            if (window.electronAPI?.quiz?.getCliPath) {
                const cli: QuizCliPathResult = await window.electronAPI.quiz.getCliPath()
                if (isMountedRef.current) setCliStatus(cli)
            }

            // Check auth status
            if (window.electronAPI?.quiz?.checkAuth) {
                const auth: QuizAuthResult = await window.electronAPI.quiz.checkAuth()
                if (isMountedRef.current) setAuthStatus({ ...auth, checking: false })
            }
        } catch (err: unknown) {
            Logger.error('[GeminiCliTab] Failed to load status:', err)
            if (isMountedRef.current) setAuthStatus({ authenticated: false, checking: false })
        } finally {
            if (isMountedRef.current) setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadStatus()

        // Refresh when window gains focus (user comes back from browser/terminal)
        const onFocus = () => loadStatus()
        window.addEventListener('focus', onFocus)

        // Poll every 3 seconds ONLY if not checking and not authenticated
        // This prevents infinite polling once connected
        let pollInterval: ReturnType<typeof setInterval> | null = null

        if (!authStatus.checking && !authStatus.authenticated) {
            pollInterval = setInterval(loadStatus, 3000)
        }

        return () => {
            window.removeEventListener('focus', onFocus)
            if (pollInterval) clearInterval(pollInterval)
        }
    }, [loadStatus, authStatus.authenticated, authStatus.checking])

    // Open login terminal
    const handleOpenLogin = useCallback(async () => {
        setIsOpeningLogin(true)
        try {
            if (window.electronAPI?.quiz?.openLogin) {
                const result: QuizActionResult = await window.electronAPI.quiz.openLogin()
                if (!result?.success) {
                    Logger.error('[GeminiCliTab] Login failed:', result.error)
                    if (isMountedRef.current) showError(t('gcli_login_failed') || 'Login failed')
                }
            }
        } catch (err: unknown) {
            Logger.error('[GeminiCliTab] Failed to open login:', err)
            if (isMountedRef.current) showError(t('gcli_login_error') || 'Failed to open login')
        } finally {
            if (isMountedRef.current) setIsOpeningLogin(false)
        }
    }, [t, showError])

    // Refresh auth status
    const handleRefreshAuth = useCallback(async () => {
        setAuthStatus(prev => ({ ...prev, checking: true }))
        try {
            if (window.electronAPI?.quiz?.checkAuth) {
                const auth: QuizAuthResult = await window.electronAPI.quiz.checkAuth()

                if (!isMountedRef.current) return

                setAuthStatus({ ...auth, checking: false })

                if (auth?.authenticated) {
                    showSuccess(t('gcli_status_connected') || 'Gemini CLI is connected')
                } else {
                    showWarning(t('gcli_status_disconnected') || 'Gemini CLI is not connected')
                }
            }
        } catch {
            if (isMountedRef.current) {
                setAuthStatus({ authenticated: false, checking: false })
                showError(t('gcli_status_error') || 'Failed to check status')
            }
        }
    }, [t, showSuccess, showWarning, showError])

    // Logout
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const handleLogout = useCallback(async () => {
        setIsLoggingOut(true)
        try {
            if (window.electronAPI?.quiz?.logout) {
                await window.electronAPI.quiz.logout()
                setAuthStatus({ authenticated: false, checking: false })
            }
        } catch (err) {
            Logger.error('[GeminiCliTab] Logout failed:', err)
        } finally {
            setIsLoggingOut(false)
        }
    }, [])

    // Open Gemini CLI docs
    const openCliDocs = useCallback(() => {
        window.electronAPI?.openExternal?.('https://github.com/google-gemini/gemini-cli')
    }, [])

    if (isLoading) {
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

