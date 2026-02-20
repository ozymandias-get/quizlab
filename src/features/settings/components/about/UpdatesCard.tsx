import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type UpdateInfo } from '@src/app/providers'
import { RefreshIcon, InfoIcon, DownloadIcon, LoaderIcon } from '@src/components/ui/Icons'

interface UpdateStatusMessageProps {
    status: string;
    updateInfo: UpdateInfo | null;
    t: (key: string) => string;
}

const UpdateStatusMessage = memo(({ status, updateInfo, t }: UpdateStatusMessageProps) => {
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
})

UpdateStatusMessage.displayName = 'UpdateStatusMessage'

interface UpdatesCardProps {
    updateStatus: 'idle' | 'checking' | 'available' | 'latest' | 'error';
    updateInfo: UpdateInfo | null;
    t: (key: string) => string;
    handleStartTour: () => void;
    checkForUpdates: () => Promise<void>;
    openReleasesPage: () => Promise<void>;
}

const UpdatesCard = memo(({
    updateStatus,
    updateInfo,
    t,
    handleStartTour,
    checkForUpdates,
    openReleasesPage
}: UpdatesCardProps) => {
    return (
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
    )
})

UpdatesCard.displayName = 'UpdatesCard'
export default UpdatesCard
