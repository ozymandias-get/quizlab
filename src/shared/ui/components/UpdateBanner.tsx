import { useOpenExternal } from '@platform/electron/api/useSystemApi'

import type { UpdateInfo } from '@app/providers'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

import { memo } from 'react'

import { CloseIcon, DownloadIcon, UpdateIcon } from './Icons'

interface UpdateBannerProps {
  updateAvailable: boolean
  updateInfo: UpdateInfo | null
  isVisible: boolean
  onClose: () => void
  t: (key: string) => string
}

const UpdateBanner = memo(function UpdateBanner({
  updateAvailable,
  updateInfo,
  isVisible,
  onClose,
  t
}: UpdateBannerProps) {
  const { mutate: openExternal } = useOpenExternal()

  if (!updateAvailable || !updateInfo || !isVisible) return null

  return (
    <div className="z-dropdown animate-in slide-in-from-top-4 fade-in fixed top-4 left-1/2 mx-4 w-full max-w-2xl -translate-x-1/2 duration-500">
      <div className="glass-tier-2 flex items-start gap-4 rounded-2xl border-emerald-400/25 bg-[linear-gradient(145deg,rgba(16,185,129,0.16),rgba(255,255,255,0.04),rgba(0,0,0,0.12))] p-4">
        <div className="glass-tier-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-emerald-400/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.18),rgba(255,255,255,0.03))] text-emerald-200 shadow-none">
          <UpdateIcon className="h-6 w-6 text-emerald-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-ql-14 mb-1 font-semibold text-emerald-100">
                {t('update_available')}
              </h3>
              <p className="text-ql-12 leading-relaxed text-stone-400">
                {t('new_version')}{' '}
                <span className="font-medium text-emerald-400">{updateInfo.version}</span>{' '}
                {t('is_available')}
                {updateInfo.releaseName && (
                  <span className="mt-1 block text-stone-500">{updateInfo.releaseName}</span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="glass-tier-3 glass-interactive shrink-0 rounded-lg border-white/[0.08] p-1.5 text-stone-500 transition-colors hover:text-stone-300"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => openExternal(APP_CONSTANTS.GITHUB_RELEASES_URL)}
              className="glass-tier-3 glass-interactive text-ql-12 flex items-center gap-2 rounded-lg border-emerald-400/25 bg-[linear-gradient(145deg,rgba(16,185,129,0.2),rgba(255,255,255,0.04))] px-3 py-1.5 font-medium text-emerald-200 transition-colors hover:scale-105"
            >
              <DownloadIcon className="h-4 w-4" />
              {t('download_from_github')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="glass-tier-3 glass-interactive text-ql-12 rounded-lg border-white/[0.08] px-3 py-1.5 font-medium text-stone-300 transition-colors hover:text-white"
            >
              {t('later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default UpdateBanner
