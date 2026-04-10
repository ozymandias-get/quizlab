import { motion } from 'framer-motion'
import SettingsModalContent from './modal/SettingsModalContent'
import SettingsModalSidebar from './modal/SettingsModalSidebar'
import { useSettingsModalState } from './modal/useSettingsModalState'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: string
}

function SettingsModal({ isOpen, onClose, initialTab }: SettingsModalProps) {
  const {
    activeTab,
    activeTabMeta,
    modalRef,
    setActiveTab,
    settings,
    sidebarScrollRef,
    sidebarSections,
    t,
    tabDefs
  } = useSettingsModalState({
    initialTab,
    isOpen,
    onClose
  })

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[rgba(2,6,12,0.72)] backdrop-blur-2xl will-change-[opacity]"
      />

      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="glass-tier-1 relative flex h-[min(680px,calc(100vh-1.5rem))] w-full max-w-6xl overflow-hidden rounded-[24px] will-change-[transform,opacity]"
      >
        <div className="flex w-full h-full">
          <SettingsModalSidebar
            activeTab={activeTab}
            activeTabMeta={activeTabMeta}
            setActiveTab={setActiveTab}
            sidebarScrollRef={sidebarScrollRef}
            sidebarSections={sidebarSections}
            t={t}
          />
          <SettingsModalContent
            activeTab={activeTab}
            onClose={onClose}
            settings={settings}
            t={t}
            tabDefs={tabDefs}
          />
        </div>
      </motion.div>
    </div>
  )
}

export default SettingsModal
