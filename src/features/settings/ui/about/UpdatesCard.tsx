import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
import type { UpdateInfo } from '@app/providers'
import { DownloadIcon, InfoIcon, LoaderIcon, RefreshIcon } from '@ui/components/Icons'

import { AnimatePresence, motion } from 'motion/react'
import { memo, type ReactNode } from 'react'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'latest' | 'error'
type UpdatesActionTone = 'accent' | 'neutral' | 'success'

interface UpdateStatusMessageProps {
  status: UpdateStatus
  updateInfo: UpdateInfo | null
  t: (key: string) => string
}

interface UpdatesActionButtonProps {
  children: ReactNode
  icon?: ReactNode
  onClick: () => Promise<void> | void
  tone: UpdatesActionTone
}

import { Button } from '@app/components/ui/button'

const UPDATE_ACTION_BUTTON_VARIANTS: Record<
  UpdatesActionTone,
  'outline' | 'default' | 'secondary'
> = {
  accent: 'outline',
  neutral: 'default',
  success: 'default'
}

function UpdatesActionButton({
  children,
  icon,
  onClick,
  tone,
  disabled
}: UpdatesActionButtonProps & { disabled?: boolean }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant={UPDATE_ACTION_BUTTON_VARIANTS[tone]}
      size="sm"
      className="w-full gap-2 sm:flex-1"
    >
      {icon}
      <span>{children}</span>
    </Button>
  )
}

function renderUpdateStatusContent(
  status: UpdateStatus,
  updateInfo: UpdateInfo | null,
  t: (key: string) => string
) {
  switch (status) {
    case 'idle':
      return (
        <p className="text-ql-12 text-muted-foreground font-medium">{t('update_not_available')}</p>
      )
    case 'latest':
      return (
        <div className="text-ql-12 flex items-center gap-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs" />
          {t('you_have_latest')}
        </div>
      )
    case 'checking':
      return (
        <div className="text-ql-12 text-muted-foreground flex items-center gap-2.5 font-medium">
          <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
          {t('checking_updates')}
        </div>
      )
    case 'available':
      if (!updateInfo) {
        return null
      }

      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-ql-12 font-semibold text-emerald-600 dark:text-emerald-400">
              {t('new_version')}:
            </span>
            <span className="text-ql-12 text-foreground font-mono font-bold transition-colors">
              {updateInfo.version}
            </span>
          </div>
          {updateInfo.releaseName && (
            <p className="text-ql-11 text-muted-foreground font-medium italic">
              &ldquo;{updateInfo.releaseName}&rdquo;
            </p>
          )}
          {updateInfo.releaseNotes && (
            <p className="text-ql-11 text-muted-foreground line-clamp-3 leading-relaxed">
              {updateInfo.releaseNotes}
            </p>
          )}
        </div>
      )
    case 'error':
      return (
        <div className="text-ql-12 text-destructive flex items-center gap-2.5 font-semibold">
          <div className="bg-destructive h-2 w-2 rounded-full" />
          {t('update_error')}
        </div>
      )
    default:
      return null
  }
}

const UpdateStatusMessage = memo(({ status, updateInfo, t }: UpdateStatusMessageProps) => {
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={status}
        layout
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        className="flex items-center gap-3"
      >
        {renderUpdateStatusContent(status, updateInfo, t)}
      </motion.div>
    </AnimatePresence>
  )
})

UpdateStatusMessage.displayName = 'UpdateStatusMessage'

interface UpdatesCardProps {
  updateStatus: UpdateStatus
  updateInfo: UpdateInfo | null
  t: (key: string) => string
  handleStartTour: () => void
  checkForUpdates: () => Promise<void>
  openReleasesPage: () => Promise<void>
}

const SHOW_CHECK_BUTTON_STATUSES: UpdateStatus[] = ['idle', 'error', 'latest', 'checking']

const UpdatesCard = memo(
  ({
    updateStatus,
    updateInfo,
    t,
    handleStartTour,
    checkForUpdates,
    openReleasesPage
  }: UpdatesCardProps) => {
    const showCheckForUpdatesButton = SHOW_CHECK_BUTTON_STATUSES.includes(updateStatus)
    const showDownloadButton = updateStatus === 'available'

    return (
      <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="border-border bg-muted text-primary rounded-lg border p-2">
              <RefreshIcon className="h-4 w-4" />
            </div>
            <h4 className="text-ql-13 text-foreground font-semibold">{t('updates')}</h4>
          </div>

          <AnimatePresence mode="wait">
            {showDownloadButton && (
              <motion.span
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-ql-10 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400"
              >
                {t('update_available')}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="border-border bg-muted/30 rounded-lg border p-3.5">
          <UpdateStatusMessage status={updateStatus} updateInfo={updateInfo} t={t} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Tooltip>
            <TooltipTrigger>
              <UpdatesActionButton
                onClick={handleStartTour}
                tone="accent"
                icon={
                  <InfoIcon
                    className="h-4 w-4 opacity-70 transition-opacity group-hover:opacity-100"
                    strokeWidth={2}
                  />
                }
              >
                {t('usage_assistant_start')}
              </UpdatesActionButton>
            </TooltipTrigger>
            <TooltipContent>{t('usage_assistant_tooltip')}</TooltipContent>
          </Tooltip>

          {showCheckForUpdatesButton && (
            <UpdatesActionButton
              onClick={checkForUpdates}
              tone="neutral"
              disabled={updateStatus === 'checking'}
            >
              {updateStatus === 'checking' ? (
                <>
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                  {t('checking_updates')}
                </>
              ) : (
                t('check_for_updates')
              )}
            </UpdatesActionButton>
          )}

          {showDownloadButton && (
            <UpdatesActionButton
              onClick={openReleasesPage}
              tone="success"
              icon={<DownloadIcon className="h-4 w-4 opacity-70" />}
            >
              {t('download_from_github')}
            </UpdatesActionButton>
          )}
        </div>
      </div>
    )
  }
)

UpdatesCard.displayName = 'UpdatesCard'
export default UpdatesCard
