import { Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@ui/components/button'
import { CloseIcon } from '@ui/components/Icons'
import { TabsContent } from '@ui/components/tabs'
import { SETTINGS_TAB_RENDERERS, type SettingsState, type SettingsTabId, type TabDef } from './settingsModalTabs'

interface SettingsModalContentProps {
    activeTab: SettingsTabId
    onClose: () => void
    settings: SettingsState
    t: (key: string) => string
    tabDefs: TabDef[]
}

export default function SettingsModalContent({
    activeTab,
    onClose,
    settings,
    t,
    tabDefs
}: SettingsModalContentProps) {
    const activeTabLabel = tabDefs.find((tab) => tab.id === activeTab)?.label

    return (
        <main className="relative flex-1 flex flex-col min-w-0 bg-gradient-to-b from-white/[0.01] to-transparent">
            <header className="flex items-center justify-between px-6 md:px-8 pt-6 md:pt-8 pb-4">
                <div className="space-y-0.5">
                    <AnimatePresence mode="wait">
                        <motion.h3
                            key={activeTab}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="text-lg md:text-xl font-bold text-white/90 tracking-tight"
                        >
                            {activeTabLabel}
                        </motion.h3>
                    </AnimatePresence>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
                        {t('configure_settings')}
                    </p>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="group h-9 w-9 rounded-xl transition-all duration-200 
                             bg-white/[0.03] border border-white/[0.09]
                             hover:bg-white/[0.08] hover:border-white/[0.18] hover:scale-105 active:scale-95"
                >
                    <CloseIcon className="w-4 h-4 text-white/35 group-hover:text-white/80 transition-colors" />
                </Button>
            </header>

            <div className="mx-6 md:mx-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-8 py-5 md:py-6">
                {tabDefs.map((tab) => (
                    <TabsContent
                        key={tab.id}
                        value={tab.id}
                        className="focus:outline-none h-full m-0 data-[state=active]:block data-[state=inactive]:hidden"
                    >
                        <Suspense fallback={
                            <div className="flex items-center justify-center p-12 h-full">
                                <div className="w-6 h-6 rounded-full border-2 border-white/15 border-t-white/50 animate-spin" />
                            </div>
                        }>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                            >
                                {SETTINGS_TAB_RENDERERS[tab.id]({ onClose, settings })}
                            </motion.div>
                        </Suspense>
                    </TabsContent>
                ))}
            </div>
        </main>
    )
}
