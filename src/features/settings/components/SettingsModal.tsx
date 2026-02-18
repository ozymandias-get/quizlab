import React, { useEffect, useRef, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useLanguage } from '@src/app/providers'
import { useSettings } from '@features/settings/hooks/useSettings'
// Icons imported from @src/components/ui/Icons
import { SettingsIcon, CloseIcon, LanguageIcon, InfoIcon, GridIcon, EyeIcon, MagicWandIcon, SelectorIcon, TerminalIcon } from '@src/components/ui/Icons'

// Lazy Load Settings Tabs
const LanguageTab = lazy(() => import('./LanguageTab'))
const AboutTab = lazy(() => import('./AboutTab'))
const ModelsTab = lazy(() => import('./ModelsTab'))
const AppearanceTab = lazy(() => import('./AppearanceTab'))
const SelectorsTab = lazy(() => import('./SelectorsTab'))
const GeminiCliTab = lazy(() => import('./GeminiCliTab'))
const PromptsTab = lazy(() => import('./PromptsTab'))

// Click outside delay (ms)
const CLICK_OUTSIDE_DELAY = 100



interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Ayarlar modalý ana bileþeni
 * Headless UI + Framer Motion Premium Redesign v2
 */
function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { t } = useLanguage()
    const modalRef = useRef<HTMLDivElement>(null)

    // Custom hook ile tüm settings state ve iþlemlerini al
    const settings = useSettings()

    // ESC tuþu ile kapatma
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // Modal dýþýna týklama ile kapatma
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        let timeout: ReturnType<typeof setTimeout> | null = null
        if (isOpen) {
            timeout = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside)
            }, CLICK_OUTSIDE_DELAY)
        }
        return () => {
            if (timeout) clearTimeout(timeout)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onClose])

    const tabDefs = React.useMemo(() => [
        { id: 'prompts', label: t('prompts'), icon: MagicWandIcon },
        { id: 'models', label: t('models'), icon: GridIcon },
        { id: 'gemini-cli', label: t('gemini_cli'), icon: TerminalIcon },
        { id: 'selectors', label: t('selectors'), icon: SelectorIcon },
        { id: 'appearance', label: t('appearance'), icon: EyeIcon },
        { id: 'language', label: t('language'), icon: LanguageIcon },
        { id: 'about', label: t('about'), icon: InfoIcon }
    ], [t])

    const renderTabContent = (id: string) => {
        switch (id) {
            case 'prompts':
                return <PromptsTab />
            case 'models':
                return <ModelsTab />
            case 'gemini-cli':
                return <GeminiCliTab />
            case 'selectors':
                return <SelectorsTab onCloseSettings={onClose} />
            case 'appearance':
                return <AppearanceTab />
            case 'language':
                return <LanguageTab />
            case 'about':
                return (
                    <AboutTab
                        appVersion={settings.appVersion}
                        updateStatus={settings.updateStatus}
                        updateInfo={settings.updateInfo}
                        checkForUpdates={settings.checkForUpdates}
                        openReleasesPage={settings.openReleasesPage}
                        onClose={onClose}
                    />
                )
            default:
                return null
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            {/* Premium Backdrop with blur */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 backdrop-blur-2xl bg-black/70 will-change-[opacity]"
            />

            {/* Ambient glow effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Modal Container */}
            <TabGroup
                as={motion.div}
                ref={modalRef}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                className="relative w-full max-w-5xl h-[680px] overflow-hidden rounded-[28px] 
                           bg-gradient-to-br from-[#0d0d12] via-[#0a0a0f] to-[#08080c]
                           border border-white/[0.08] flex
                           shadow-[0_50px_100px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]
                           will-change-[transform,opacity]"
            >
                {({ selectedIndex }) => (
                    <>
                        {/* Sidebar Navigation */}
                        <aside className="relative w-56 flex flex-col bg-white/[0.02] border-r border-white/[0.06]">
                            {/* Header */}
                            <div className="p-6 pb-4">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/[0.1] shadow-lg">
                                        <SettingsIcon className="w-5 h-5 text-white/60" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-white/90 tracking-tight">
                                            {t('settings_title')}
                                        </h2>
                                        <p className="text-[9px] text-white/30 uppercase tracking-widest font-medium">
                                            {t('settings')}
                                        </p>
                                    </div>
                                </div>

                                <TabList className="flex flex-col gap-1">
                                    {tabDefs.map((tab) => (
                                        <Tab
                                            key={tab.id}
                                            className={({ selected }) => `
                                                group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 outline-none
                                                ${selected
                                                    ? 'bg-white/[0.1] text-white shadow-lg'
                                                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                                                }
                                            `}
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <tab.icon className={`w-4 h-4 transition-all duration-200 ${selected ? 'text-white' : 'text-white/30 group-hover:text-white/50'}`} />
                                                    <span className="relative z-10">{tab.label}</span>
                                                    {selected && (
                                                        <motion.div
                                                            layoutId="active-indicator"
                                                            className="absolute left-0 w-0.5 h-5 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </Tab>
                                    ))}
                                </TabList>
                            </div>

                            {/* Sidebar Footer */}
                            <div className="mt-auto p-6 pt-4 border-t border-white/[0.04]">
                                <div className="flex items-center gap-2.5">
                                    <div className="relative">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-50" />
                                    </div>
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                                        {t('system_ok') || 'System OK'}
                                    </span>
                                </div>
                            </div>
                        </aside>

                        {/* Main Content Area */}
                        <main className="relative flex-1 flex flex-col min-w-0 bg-gradient-to-br from-white/[0.01] to-transparent">
                            {/* Content Header */}
                            <header className="flex items-center justify-between px-8 pt-8 pb-4">
                                <div className="space-y-0.5">
                                    <AnimatePresence mode="wait">
                                        <motion.h3
                                            key={selectedIndex}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="text-xl font-bold text-white/90 tracking-tight"
                                        >
                                            {tabDefs[selectedIndex]?.label}
                                        </motion.h3>
                                    </AnimatePresence>
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
                                        {t('configure_settings')}
                                    </p>
                                </div>

                                <button
                                    onClick={onClose}
                                    className="group p-2.5 rounded-xl transition-all duration-200 
                                             bg-white/[0.03] border border-white/[0.06]
                                             hover:bg-red-500/10 hover:border-red-500/20 hover:scale-105 active:scale-95"
                                >
                                    <CloseIcon className="w-4 h-4 text-white/30 group-hover:text-red-400 transition-colors" />
                                </button>
                            </header>

                            {/* Divider */}
                            <div className="mx-8 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                                <TabPanels>
                                    {tabDefs.map((tab) => (
                                        <TabPanel
                                            key={tab.id}
                                            className="focus:outline-none"
                                        >
                                            <Suspense fallback={
                                                <div className="flex items-center justify-center p-12">
                                                    <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
                                                </div>
                                            }>
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                                >
                                                    {renderTabContent(tab.id)}
                                                </motion.div>
                                            </Suspense>
                                        </TabPanel>
                                    ))}
                                </TabPanels>
                            </div>
                        </main>
                    </>
                )}
            </TabGroup>
        </div>
    )
}

export default SettingsModal


