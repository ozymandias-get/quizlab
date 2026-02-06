import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useLanguage, useToast } from '@src/app/providers'
import type { QuizAuthResult, QuizCliPathResult, QuizActionResult } from '@shared/types'

interface IconProps {
    className?: string;
}

interface CliStatus {
    path: string;
    exists: boolean;
}

interface AuthStatus {
    authenticated: boolean;
    checking: boolean;
    account?: string | null;
}

// Terminal icon
const TerminalIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
)

// Check icon
const CheckIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
)

// X icon
const XIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
)

// Loader icon
const LoaderIcon = ({ className }: IconProps) => (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" opacity="1"></path>
    </svg>
)

// External link icon
const ExternalLinkIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
)

// Google icon
const GoogleIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
)

// Refresh icon
const RefreshIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
    </svg>
)

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
            console.error('[GeminiCliTab] Failed to load status:', err)
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
                    console.error('[GeminiCliTab] Login failed:', result.error)
                    if (isMountedRef.current) showError(t('gcli_login_failed') || 'Login failed')
                }
            }
        } catch (err: unknown) {
            console.error('[GeminiCliTab] Failed to open login:', err)
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
            console.error('[GeminiCliTab] Logout failed:', err)
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

