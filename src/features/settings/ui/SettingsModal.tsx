import { motion } from 'framer-motion'
import { Tabs } from '@ui/components/tabs'
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
                className="absolute inset-0 bg-black/80 backdrop-blur-xl will-change-[opacity]"
            />

            <motion.div
                ref={modalRef}
                initial={{ opacity: 0, scale: 0.96, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                className="relative w-full max-w-6xl h-[min(680px,calc(100vh-1.5rem))] overflow-hidden rounded-[24px] 
                           bg-gradient-to-b from-[#0b0b0b] via-[#080808] to-[#050505]
                           border border-white/[0.09] flex
                           shadow-[0_40px_120px_-50px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.04)]
                           will-change-[transform,opacity]"
            >
                <Tabs className="flex w-full h-full" value={activeTab} onValueChange={setActiveTab}>
                    <SettingsModalSidebar
                        activeTab={activeTab}
                        activeTabMeta={activeTabMeta}
                        sidebarScrollRef={sidebarScrollRef}
                        t={t}
                        tabDefs={tabDefs}
                    />
                    <SettingsModalContent
                        activeTab={activeTab}
                        onClose={onClose}
                        settings={settings}
                        t={t}
                        tabDefs={tabDefs}
                    />
                </Tabs>
            </motion.div>
        </div>
    )
}

export default SettingsModal
