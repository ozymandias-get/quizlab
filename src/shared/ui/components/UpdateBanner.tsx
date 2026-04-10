import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { UpdateIcon, CloseIcon, DownloadIcon } from './Icons'

import { useOpenExternal } from '@platform/electron/api/useSystemApi'

import { type UpdateInfo } from '@app/providers'

interface UpdateBannerProps {
  updateAvailable: boolean
  updateInfo: UpdateInfo | null
  isVisible: boolean
  onClose: () => void
  t: (key: string) => string
}

function UpdateBanner({ updateAvailable, updateInfo, isVisible, onClose, t }: UpdateBannerProps) {
  const { mutate: openExternal } = useOpenExternal()

  if (!updateAvailable || !updateInfo || !isVisible) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] max-w-2xl w-full mx-4 animate-in slide-in-from-top-4 fade-in duration-500">
      <div className="glass-tier-2 rounded-2xl border-emerald-400/25 bg-[linear-gradient(145deg,rgba(16,185,129,0.16),rgba(255,255,255,0.04),rgba(0,0,0,0.12))] p-4 flex items-start gap-4">
        <div className="glass-tier-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-emerald-400/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.18),rgba(255,255,255,0.03))] text-emerald-200 shadow-none">
          <UpdateIcon className="w-6 h-6 text-emerald-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-emerald-100 font-semibold text-ql-14 mb-1">
                {t('update_available')}
              </h3>
              <p className="text-stone-400 text-ql-12 leading-relaxed">
                {t('new_version')}{' '}
                <span className="text-emerald-400 font-medium">{updateInfo.version}</span>{' '}
                {t('is_available')}
                {updateInfo.releaseName && (
                  <span className="block mt-1 text-stone-500">{updateInfo.releaseName}</span>
                )}
              </p>
            </div>

            <button
              onClick={onClose}
              className="glass-tier-3 glass-interactive flex-shrink-0 rounded-lg border-white/[0.08] p-1.5 text-stone-500 transition-colors hover:text-stone-300"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => openExternal(APP_CONSTANTS.GITHUB_RELEASES_URL)}
              className="glass-tier-3 glass-interactive flex items-center gap-2 rounded-lg border-emerald-400/25 bg-[linear-gradient(145deg,rgba(16,185,129,0.2),rgba(255,255,255,0.04))] px-3 py-1.5 text-ql-12 font-medium text-emerald-200 transition-all hover:scale-105"
            >
              <DownloadIcon className="w-4 h-4" />
              {t('download_from_github')}
            </button>
            <button
              onClick={onClose}
              className="glass-tier-3 glass-interactive rounded-lg border-white/[0.08] px-3 py-1.5 text-ql-12 font-medium text-stone-300 transition-colors hover:text-white"
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
