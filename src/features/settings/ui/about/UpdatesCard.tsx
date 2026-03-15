import { memo, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type UpdateInfo } from '@app/providers'
import { RefreshIcon, InfoIcon, DownloadIcon, LoaderIcon } from '@ui/components/Icons'

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

const UPDATE_ACTION_BUTTON_CLASSES: Record<UpdatesActionTone, string> = {
  accent:
    'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:shadow-xl shadow-md',
  neutral:
    'bg-white/[0.1] border border-white/20 text-white hover:bg-white/[0.15] hover:shadow-xl shadow-md',
  success: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
}

function UpdatesActionButton({ children, icon, onClick, tone }: UpdatesActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex-1 overflow-hidden rounded-2xl px-6 py-4 text-sm font-bold transition-all duration-300 ${UPDATE_ACTION_BUTTON_CLASSES[tone]}`}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  )
}

function renderUpdateStatusContent(
  status: UpdateStatus,
  updateInfo: UpdateInfo | null,
  t: (key: string) => string
) {
  switch (status) {
    case 'idle':
      return <p className="text-xs font-medium italic text-white/30">{t('update_not_available')}</p>
    case 'latest':
      return (
        <div className="flex items-center gap-3 text-xs font-bold text-emerald-400">
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          {t('you_have_latest')}
        </div>
      )
    case 'checking':
      return (
        <div className="flex items-center gap-3 text-xs font-bold text-white/40">
          <LoaderIcon className="w-4 h-4 opacity-40" />
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
            <span className="text-xs font-bold text-emerald-400">{t('new_version')}:</span>
            <span className="text-xs font-mono font-bold text-white/80 transition-colors">
              {updateInfo.version}
            </span>
          </div>
          {updateInfo.releaseName && (
            <p className="text-[10px] font-bold uppercase tracking-widest italic text-white/30">
              "{updateInfo.releaseName}"
            </p>
          )}
        </div>
      )
    case 'error':
      return (
        <div className="flex items-center gap-3 text-xs font-bold text-rose-400">
          <div className="h-2 w-2 rounded-full bg-rose-400" />
          {t('update_error')}
        </div>
      )
    default:
      return null
  }
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

const SHOW_CHECK_BUTTON_STATUSES: UpdateStatus[] = ['idle', 'error', 'latest']

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
      <div className="space-y-6 rounded-[28px] border border-white/[0.1] bg-white/[0.03] p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/[0.1] bg-white/[0.06] p-2.5 text-white/50">
              <RefreshIcon className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold tracking-wide text-white">{t('updates')}</h4>
          </div>

          <AnimatePresence mode="wait">
            {showDownloadButton && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400/80"
              >
                {t('update_available')}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="rounded-2xl border border-white/[0.02] bg-white/[0.01] p-5">
          <UpdateStatusMessage status={updateStatus} updateInfo={updateInfo} t={t} />
        </div>

        <div className="flex gap-3">
          <UpdatesActionButton
            onClick={handleStartTour}
            tone="accent"
            icon={
              <InfoIcon
                className="w-5 h-5 opacity-60 transition-opacity group-hover:opacity-100"
                strokeWidth={2}
              />
            }
          >
            {t('usage_assistant_start')}
          </UpdatesActionButton>

          {showCheckForUpdatesButton && (
            <UpdatesActionButton onClick={checkForUpdates} tone="neutral">
              {t('check_for_updates')}
            </UpdatesActionButton>
          )}

          {showDownloadButton && (
            <UpdatesActionButton
              onClick={openReleasesPage}
              tone="success"
              icon={<DownloadIcon className="w-5 h-5 opacity-50" />}
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
