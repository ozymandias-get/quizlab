import React, { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage, useAppearance, type UpdateInfo } from '@src/app/providers'
import { APP_CONSTANTS } from '@src/constants/appConstants'
import appIcon from '@src/assets/icon.png'
import {
    RefreshIcon,
    DownloadIcon,
    GithubIcon,
    ChevronRightIcon,
    LoaderIcon,
    CheckIcon,
    TrashIcon,
    InfoIcon
} from '@src/components/ui/Icons'


interface AboutTabProps {
    appVersion: string;
    updateStatus: 'idle' | 'checking' | 'available' | 'latest' | 'error';
    updateInfo: UpdateInfo | null;
    checkForUpdates: () => Promise<void>;
    openReleasesPage: () => Promise<void>;
    onClose: () => void;
}

/**
 * Hakkında sekmesi bileşeni - Headless UI Style Premium Redesign
 */
const AboutTab = React.memo(({
    appVersion,
    updateStatus,
    updateInfo,
    checkForUpdates,
    openReleasesPage,
    onClose
}: AboutTabProps) => {
    const { t } = useLanguage()
    const { startTour } = useAppearance()

    const [cacheStatus, setCacheStatus] = React.useState<'idle' | 'clearing' | 'success' | 'error'>('idle')

    const handleStartTour = useCallback(() => {
        if (onClose) onClose()
        // Modalın kapanma animasyonu için kısa bir gecikme
        setTimeout(() => {
            startTour()
        }, 300)
    }, [onClose, startTour])

    const handleClearCache = useCallback(async () => {
        setCacheStatus('clearing')
        try {
            if (window.electronAPI && window.electronAPI.clearCache) {
                const success = await window.electronAPI.clearCache()
                if (success) {
                    setCacheStatus('success')
                    setTimeout(() => setCacheStatus('idle'), 3000)
                } else {
                    setCacheStatus('error')
                }
            } else {
                setCacheStatus('error')
            }
        } catch (error) {
            console.error('Cache clear failed', error)
            setCacheStatus('error')
            setTimeout(() => setCacheStatus('idle'), 3000)
        }
    }, [])

    return (
        <div className="space-y-8 pb-4">
            {/* App Info Section */}
            <header className="relative flex flex-col items-center p-10 rounded-[32px] bg-white/[0.02] border border-white/[0.05] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

                {/* App Icon with soft glow */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative mb-6"
                >
                    <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full" />
                    <img
                        src={appIcon}
                        alt="Quizlab Reader"
                        className="relative w-24 h-24 rounded-3xl shadow-2xl border border-white/10"
                    />
                </motion.div>

                <div className="text-center relative z-10 space-y-3">
                    <h3 className="text-3xl font-black text-white tracking-tight">
                        {t('app_name')}
                    </h3>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{t('version')}</span>
                        <span className="text-[11px] font-mono font-bold text-white px-3 py-1 rounded-lg bg-white/10 border border-white/20 shadow-lg">
                            {appVersion}
                        </span>
                    </div>
                </div>
            </header>

            {/* Update & Links Section */}
            <div className="grid grid-cols-1 gap-4">
                {/* Updates Card */}
                <div className="p-8 rounded-[28px] bg-white/[0.03] border border-white/[0.1] space-y-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-white/[0.06] text-white/50 border border-white/[0.1]">
                                <RefreshIcon className="w-5 h-5" />
                            </div>
                            <h4 className="text-sm font-bold text-white tracking-wide">{t('updates')}</h4>
                        </div>

                        <AnimatePresence mode="wait">
                            {updateStatus === 'available' && (
                                <motion.span
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400/80"
                                >
                                    {t('update_available')}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/[0.02]">
                        <UpdateStatusMessage
                            status={updateStatus}
                            updateInfo={updateInfo}
                            t={t}
                        />
                    </div>

                    <div className="flex gap-3">
                        {/* Manual Tour Start Button - Added as requested */}
                        {/* Usage Assistant Button */}
                        <button
                            onClick={handleStartTour}
                            className="flex-1 group relative overflow-hidden px-6 py-4 rounded-2xl transition-all duration-300
                                       bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-sm hover:bg-blue-500/20 hover:shadow-xl shadow-md"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                <InfoIcon className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
                                {t('usage_assistant_start')}
                            </span>
                        </button>

                        {(updateStatus === 'idle' || updateStatus === 'error' || updateStatus === 'latest') && (
                            <button
                                onClick={checkForUpdates}
                                className="flex-1 group relative overflow-hidden px-6 py-4 rounded-2xl transition-all duration-300
                                           bg-white/[0.1] border border-white/20 text-white font-bold text-sm hover:bg-white/[0.15] hover:shadow-xl shadow-md"
                            >
                                <span className="relative z-10">{t('check_for_updates')}</span>
                            </button>
                        )}

                        {updateStatus === 'available' && (
                            <button
                                onClick={openReleasesPage}
                                className="flex-1 group relative overflow-hidden px-6 py-4 rounded-2xl transition-all duration-300
                                           bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm hover:bg-emerald-500/20"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    <DownloadIcon className="w-5 h-5 opacity-50" />
                                    {t('download_from_github')}
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Repository Link */}
                <a
                    href={APP_CONSTANTS.GITHUB_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.12] hover:bg-white/[0.08] transition-all duration-300 shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-white/[0.08] text-white/60 border border-white/[.15] group-hover:scale-110 group-hover:bg-white/[0.15] group-hover:text-white transition-all shadow-md">
                            <GithubIcon className="w-6 h-6" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-sm font-bold text-white group-hover:text-white transition-colors">{t('github_repository')}</span>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest leading-none font-bold italic">{t('view_source_code')}</p>
                        </div>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-white/20 group-hover:text-white transition-colors transform group-hover:translate-x-1" />
                </a>

                {/* Cache Control */}
                <div className="flex items-center justify-between p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.12]">
                    <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">{t('clear_cache_title')}</h4>
                        <p className="text-xs text-white/40">{t('clear_cache_desc')}</p>
                    </div>
                    <button
                        onClick={handleClearCache}
                        disabled={cacheStatus === 'clearing'}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${cacheStatus === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                            }`}
                    >
                        {cacheStatus === 'clearing' ? (
                            <>
                                <LoaderIcon className="w-4 h-4 text-white" />
                                {t('clearing')}
                            </>
                        ) : cacheStatus === 'success' ? (
                            <>
                                <CheckIcon className="w-4 h-4" />
                                {t('cleared')}
                            </>
                        ) : (
                            <>
                                <TrashIcon className="w-4 h-4" />
                                {t('clear_cache')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
})

AboutTab.displayName = 'AboutTab'

interface UpdateStatusMessageProps {
    status: string;
    updateInfo: UpdateInfo | null;
    t: (key: string) => string;
}

/**
 * Güncelleme durumu mesajı bileşeni
 */
function UpdateStatusMessage({ status, updateInfo, t }: UpdateStatusMessageProps) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={status}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-3"
            >
                {status === 'idle' && (
                    <p className="text-xs font-medium text-white/30 italic">
                        {t('update_not_available')}
                    </p>
                )}

                {status === 'latest' && (
                    <div className="flex items-center gap-3 text-xs font-bold text-emerald-400">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        {t('you_have_latest')}
                    </div>
                )}

                {status === 'checking' && (
                    <div className="flex items-center gap-3 text-xs font-bold text-white/40">
                        <LoaderIcon className="w-4 h-4 opacity-40" />
                        {t('checking_updates')}
                    </div>
                )}

                {status === 'available' && updateInfo && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-400">{t('new_version')}:</span>
                            <span className="text-xs font-mono font-bold text-white/80 transition-colors">{updateInfo.version}</span>
                        </div>
                        {updateInfo.releaseName && (
                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold italic">
                                "{updateInfo.releaseName}"
                            </p>
                        )}
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex items-center gap-3 text-xs font-bold text-rose-400">
                        <div className="w-2 h-2 rounded-full bg-rose-400" />
                        {t('update_error')}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    )
}

export default AboutTab

