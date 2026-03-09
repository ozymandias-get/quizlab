import React, { useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Query } from '@tanstack/react-query'
import { useLanguage, useToast } from '@app/providers'
import { useCheckAuth, useCliPath, useOpenLogin, useLogout } from '@platform/electron/api/useQuizApi'
import { useOpenExternal } from '@platform/electron/api/useSystemApi'
import { TerminalIcon, CheckIcon, XIcon, LoaderIcon, ExternalLinkIcon, GoogleIcon, RefreshIcon } from '@ui/components/Icons'
import type { QuizAuthResult } from '@shared-core/types'

type GeminiCliActionButtonVariant = 'primary' | 'danger' | 'secondary'

interface GeminiCliActionButtonProps {
    children: React.ReactNode
    disabled?: boolean
    icon: React.ReactNode
    onClick: () => void | Promise<void>
    variant: GeminiCliActionButtonVariant
}

interface GeminiCliUsageStepCardProps {
    description: string
    icon: React.ReactNode
    iconClassName: string
    title: string
}

const ACTION_BUTTON_CLASSNAMES: Record<GeminiCliActionButtonVariant, string> = {
    primary: 'inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-800 shadow-lg transition-all hover:bg-gray-100 disabled:opacity-50',
    danger: 'inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-bold text-red-400 transition-all hover:bg-red-500/30 disabled:opacity-50',
    secondary: 'inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition-all hover:bg-white/20 hover:text-white disabled:opacity-50',
}

function GeminiCliActionButton({ children, disabled, icon, onClick, variant }: GeminiCliActionButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={ACTION_BUTTON_CLASSNAMES[variant]}
        >
            {icon}
            {children}
        </button>
    )
}

function GeminiCliUsageStepCard({ description, icon, iconClassName, title }: GeminiCliUsageStepCardProps) {
    return (
        <div className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className={`h-fit shrink-0 rounded-lg p-2 ${iconClassName}`}>
                {icon}
            </div>
            <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white/90">{title}</h4>
                <p className="text-xs leading-relaxed text-white/60">{description}</p>
            </div>
        </div>
    )
}

/**
 * Gemini CLI Settings Tab
 * Shows CLI status, auth status and allows model selection
 */
const GeminiCliTab = React.memo(() => {
    const { t } = useLanguage()
    const { showError } = useToast()
    const { data: cliStatus, isLoading: isCliLoading } = useCliPath()
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

    const isAuthenticated = Boolean(authData?.authenticated)
    const isCheckingAuth = isAuthLoading || isAuthChecking
    const connectedAccount = authData?.account
    const shouldShowConnectedAccount = Boolean(
        isAuthenticated && connectedAccount && connectedAccount !== 'Google OAuth'
    )
    const authBannerClassName = isAuthenticated
        ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/20'
        : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20'
    const authIconContainerClassName = isAuthenticated ? 'bg-emerald-500/20' : 'bg-amber-500/20'
    const authTitleClassName = isAuthenticated ? 'text-emerald-400' : 'text-amber-400'
    const authTitle = isAuthenticated ? t('gcli_account_connected') : t('gcli_login_required')
    const authDescription = isAuthenticated ? t('gcli_ready_desc') : t('gcli_login_desc')
    const usageSteps = [
        {
            description: t('gcli_step1_desc'),
            icon: <TerminalIcon className="w-5 h-5" />,
            iconClassName: 'bg-blue-500/20 text-blue-400',
            title: t('gcli_step1_title')
        },
        {
            description: t('gcli_step2_desc'),
            icon: <CheckIcon className="w-5 h-5" />,
            iconClassName: 'bg-emerald-500/20 text-emerald-400',
            title: t('gcli_step2_title')
        }
    ]

    const handleOpenLogin = useCallback(async () => {
        try {
            const result = await openLogin()
            if (!result?.success && result?.error) {
                showError(result.error)
            }
        } catch {
            // Error already shown via toast in useElectronMutation.
        }
    }, [openLogin, showError])

    const handleRefreshAuth = useCallback(() => {
        refreshAuth()
    }, [refreshAuth])

    const handleLogout = useCallback(async () => {
        try {
            await logout()
        } catch {
            // Error already shown via toast in useElectronMutation.
        }
    }, [logout])

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
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-4 ${authBannerClassName}`}
            >
                <div className="flex items-start gap-3">
                    <div className={`rounded-xl p-2 ${authIconContainerClassName}`}>
                        {isCheckingAuth ? (
                            <LoaderIcon className="w-5 h-5 text-white/40" />
                        ) : isAuthenticated ? (
                            <CheckIcon className="w-5 h-5 text-emerald-400" />
                        ) : (
                            <XIcon className="w-5 h-5 text-amber-400" />
                        )}
                    </div>
                    <div className="flex-1">
                        <h4 className={`mb-1 text-sm font-bold ${authTitleClassName}`}>
                            {authTitle}
                        </h4>
                        <p className="text-xs leading-relaxed text-white/50">
                            {authDescription}
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                            {!isAuthenticated && (
                                <GeminiCliActionButton
                                    onClick={handleOpenLogin}
                                    disabled={isOpeningLogin}
                                    variant="primary"
                                    icon={
                                        isOpeningLogin
                                            ? <LoaderIcon className="w-4 h-4 text-gray-600" />
                                            : <GoogleIcon className="w-4 h-4" />
                                    }
                                >
                                    {t('gcli_login_btn')}
                                </GeminiCliActionButton>
                            )}

                            {isAuthenticated && (
                                <GeminiCliActionButton
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    variant="danger"
                                    icon={
                                        isLoggingOut
                                            ? <LoaderIcon className="w-4 h-4" />
                                            : <XIcon className="w-4 h-4" />
                                    }
                                >
                                    {t('gcli_logout_btn')}
                                </GeminiCliActionButton>
                            )}

                            <GeminiCliActionButton
                                onClick={handleRefreshAuth}
                                disabled={isCheckingAuth}
                                variant="secondary"
                                icon={<RefreshIcon className={`w-3.5 h-3.5 ${isCheckingAuth ? 'animate-spin' : ''}`} />}
                            >
                                {t('gcli_check_status')}
                            </GeminiCliActionButton>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="mb-6 space-y-4">
                <h3 className="px-1 text-sm font-bold uppercase tracking-wider text-white/70">
                    {t('gcli_how_to_use')}
                </h3>

                <div className="grid gap-3">
                    {usageSteps.map((step) => (
                        <GeminiCliUsageStepCard
                            key={step.title}
                            description={step.description}
                            icon={step.icon}
                            iconClassName={step.iconClassName}
                            title={step.title}
                        />
                    ))}
                </div>
            </div>

            {shouldShowConnectedAccount && (
                <div className="mb-6 space-y-2">
                    <label className="pl-1 text-xs font-bold uppercase tracking-widest text-white/40">
                        {t('gcli_connected_account')}
                    </label>
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
                        <div className="flex items-center justify-center rounded-full bg-white p-2">
                            <GoogleIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white/90">
                                {connectedAccount}
                            </p>
                            <p className="text-xs text-emerald-400/60">
                                {t('gcli_active_session')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-500/20 p-1.5">
                        <TerminalIcon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs leading-relaxed text-blue-200/80">
                            <strong>{t('gcli_note')}</strong> {t('gcli_note_desc')}
                        </p>
                        <button
                            onClick={openCliDocs}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 transition-colors hover:text-blue-300"
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
