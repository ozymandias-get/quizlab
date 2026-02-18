import React from 'react'
import { APP_CONSTANTS } from '@src/constants/appConstants'
import { UpdateIcon, CloseIcon, DownloadIcon } from './Icons'

import { useOpenExternal } from '@platform/electron/api/useSystemApi'

import { type UpdateInfo } from '@src/app/providers'

interface UpdateBannerProps {
    updateAvailable: boolean;
    updateInfo: UpdateInfo | null;
    isVisible: boolean;
    onClose: () => void;
    t: (key: string) => string;
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({
    updateAvailable,
    updateInfo,
    isVisible,
    onClose,
    t
}) => {
    const { mutate: openExternal } = useOpenExternal()

    if (!updateAvailable || !updateInfo || !isVisible) return null

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] max-w-2xl w-full mx-4 animate-in slide-in-from-top-4 fade-in duration-500">
            <div className="bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-emerald-500/5 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl shadow-emerald-900/20 p-4 flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <UpdateIcon className="w-6 h-6 text-emerald-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-emerald-100 font-semibold text-sm mb-1">
                                {t('update_available')}
                            </h3>
                            <p className="text-stone-400 text-xs leading-relaxed">
                                {t('new_version')} <span className="text-emerald-400 font-medium">{updateInfo.version}</span> {t('is_available')}
                                {updateInfo.releaseName && (
                                    <span className="block mt-1 text-stone-500">{updateInfo.releaseName}</span>
                                )}
                            </p>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-stone-800/50 transition-colors text-stone-500 hover:text-stone-300"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => openExternal(APP_CONSTANTS.GITHUB_RELEASES_URL)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium rounded-lg transition-all hover:scale-105"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            {t('download_from_github')}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 hover:bg-stone-800/50 text-stone-400 hover:text-stone-300 text-xs font-medium rounded-lg transition-colors"
                        >
                            {t('later')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default UpdateBanner


