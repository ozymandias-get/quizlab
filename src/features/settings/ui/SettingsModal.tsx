import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { DialogBackdrop } from '@app/components/ui/dialog'
import { Separator } from '@app/components/ui/separator'
import { useConfirmDialog, useDialogBehavior } from '@shared/hooks'
import { DURATION } from '@shared/lib/motion'
import { Button } from '@shared/ui/components/primitives'
import { CloseIcon, SettingsIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { memo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import ResizableHandle from './modal/ResizableHandle'
import { useHasDirtySettings } from './modal/settingsDirtyGuard'
import SettingsModalContent from './modal/SettingsModalContent'
import SettingsModalSidebar from './modal/SettingsModalSidebar'
import { useResizableColumns } from './modal/useResizableColumns'
import { useSettingsModalState } from './modal/useSettingsModalState'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: string
}

const SettingsModal = memo(function SettingsModal({
  isOpen,
  onClose,
  initialTab
}: SettingsModalProps) {
  const { activeTab, activeTabMeta, setActiveTab, sidebarScrollRef, sidebarSections } =
    useSettingsModalState({
      isOpen,
      initialTab
    })
  const { t } = useTranslation()

  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const hasUnsavedChanges = useHasDirtySettings()
  const { confirm, props: confirmProps } = useConfirmDialog()

  /**
   * The single close path — the header button, Escape and any tab that asks the
   * modal to close (the selector flow does) all end here. Discarding is the
   * only destructive possibility, so it is the only one that asks. Form
   * registrations are cleaned up by their own unmount effects.
   */
  const handleRequestClose = useCallback(async () => {
    if (hasUnsavedChanges) {
      const discard = await confirm({
        title: t('settings_unsaved_changes_title'),
        description: t('settings_unsaved_changes_description'),
        confirmLabel: t('settings_discard_changes'),
        cancelLabel: t('settings_keep_editing'),
        variant: 'destructive'
      })
      if (!discard) return
    }
    onClose()
  }, [confirm, hasUnsavedChanges, onClose, t])

  useDialogBehavior({
    isOpen,
    onClose: handleRequestClose,
    dialogRef,
    initialFocusRef: closeButtonRef
  })

  const { sidebarWidth, handleSidebarResize, containerRef, isCompact } = useResizableColumns()

  if (!isOpen) {
    return null
  }

  return (
    <DialogBackdrop
      onClick={(event) => {
        // The backdrop closes the window; clicks that started inside the panel
        // (or inside the confirm dialog) bubble here and must not.
        if (event.target === event.currentTarget) void handleRequestClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="flex h-[85vh] max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-2xl backdrop-blur-xl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: DURATION.normal }}
          className="flex h-full min-h-0 flex-col"
        >
          <header className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                <SettingsIcon className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <h1
                  id="settings-dialog-title"
                  className="text-foreground tracking-ql-tight text-ql-16 font-semibold"
                >
                  {t('settings_title')}
                </h1>
                <p className="text-muted-foreground text-ql-12 hidden sm:block">
                  {t('settings_header_description')}
                </p>
              </div>
            </div>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              onClick={handleRequestClose}
              aria-label={t('tab_close')}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </Button>
          </header>

          <Separator />
          <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
            <SettingsModalSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              sidebarScrollRef={sidebarScrollRef}
              sidebarSections={sidebarSections}
              sidebarWidth={sidebarWidth}
              isCompact={isCompact}
            />

            {!isCompact && (
              <div className="max-[768px]:hidden">
                <ResizableHandle
                  onResize={handleSidebarResize}
                  value={sidebarWidth}
                  label="Resize settings sidebar"
                />
              </div>
            )}

            <SettingsModalContent
              activeTab={activeTab}
              activeTabMeta={activeTabMeta}
              onClose={handleRequestClose}
              setActiveTab={setActiveTab}
            />
          </div>
        </motion.div>
      </div>

      <ConfirmDialog {...confirmProps} />
    </DialogBackdrop>
  )
})

export default SettingsModal
