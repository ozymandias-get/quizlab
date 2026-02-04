import React, { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../../context/LanguageContext'
import { useAppearance } from '../../context/AppearanceContext'
import { APP_CONSTANTS } from '../../constants/appConstants'
import { UpdateInfo } from '../../context/UpdateContext'
import appIcon from '../../assets/icon.png'

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
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
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
                                <svg className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
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
                                    <svg className="w-5 h-5 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                    </svg>
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
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-sm font-bold text-white group-hover:text-white transition-colors">{t('github_repository')}</span>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest leading-none font-bold italic">{t('view_source_code')}</p>
                        </div>
                    </div>
                    <svg className="w-5 h-5 text-white/20 group-hover:text-white transition-colors transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                {t('clearing')}
                            </>
                        ) : cacheStatus === 'success' ? (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                {t('cleared')}
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle className="opacity-10" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-40" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
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
