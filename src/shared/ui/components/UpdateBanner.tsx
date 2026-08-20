import { useOpenExternal } from '@platform/electron/api/useSystemApi'

import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
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
    <div className="z-dropdown animate-in slide-in-from-top-4 fade-in motion-slower fixed top-4 left-1/2 mx-4 w-full max-w-xl -translate-x-1/2">
      <div className="border-border bg-popover text-popover-foreground shadow-ambient-lg flex items-start gap-3.5 rounded-xl border p-4 backdrop-blur-md">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <UpdateIcon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-ql-13 text-foreground mb-0.5 font-semibold">
                {t('update_available')}
              </h3>
              <p className="text-ql-12 text-muted-foreground leading-relaxed">
                {t('new_version')}{' '}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {updateInfo.version}
                </span>{' '}
                {t('is_available')}
                {updateInfo.releaseName && (
                  <span className="text-muted-foreground/80 mt-0.5 block">
                    {updateInfo.releaseName}
                  </span>
                )}
              </p>
            </div>

            <IconButton
              type="button"
              size="compact"
              variant="ghost"
              onClick={onClose}
              aria-label={t('close')}
            >
              <CloseIcon />
            </IconButton>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => openExternal(APP_CONSTANTS.GITHUB_RELEASES_URL)}
              className="text-ql-12 shadow-xs"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              {t('download_from_github')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-ql-12"
            >
              {t('later')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default UpdateBanner
