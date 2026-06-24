import { Button } from '@app/components/ui/button'
import { Separator } from '@app/components/ui/separator'
import { CloseIcon, SettingsIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { memo } from 'react'

import ResizableHandle from './modal/ResizableHandle'
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
  const { activeTab, setActiveTab, settings, sidebarScrollRef, sidebarSections, t, tabDefs } =
    useSettingsModalState({
      initialTab,
      isOpen,
      onClose
    })

  const { sidebarWidth, handleSidebarResize } = useResizableColumns()

  if (!isOpen) {
    return null
  }

  return (
    <div className="z-overlay bg-background fixed inset-0 flex flex-col">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="flex h-full flex-col"
      >
        <header className="flex shrink-0 items-center justify-between px-3 py-3 sm:px-5 sm:py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="border-border bg-card flex h-8 w-8 items-center justify-center rounded-xl border">
              <SettingsIcon className="text-muted-foreground h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h1 className="text-foreground text-sm font-semibold tracking-tight">
                {t('settings_title')}
              </h1>
              <p className="text-muted-foreground hidden text-xs sm:block">
                {t('settings_header_description')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('tab_close') || 'Close'}
            className="border-border bg-card text-muted-foreground hover:bg-accent h-8 w-8 rounded-lg border"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </Button>
        </header>

        <Separator />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <SettingsModalSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            sidebarScrollRef={sidebarScrollRef}
            sidebarSections={sidebarSections}
            t={t}
            sidebarWidth={sidebarWidth}
            tabDefs={tabDefs}
          />

          <div className="max-[768px]:hidden">
            <ResizableHandle onResize={handleSidebarResize} />
          </div>

          <SettingsModalContent
            activeTab={activeTab}
            onClose={onClose}
            settings={settings}
            t={t}
            tabDefs={tabDefs}
            setActiveTab={setActiveTab}
          />
        </div>
      </motion.div>
    </div>
  )
})

export default SettingsModal
