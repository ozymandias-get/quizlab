import React, { useEffect, useRef, Suspense, lazy, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ui/components/tabs'
import { Button } from '@ui/components/button'
import { useLanguage } from '@app/providers'
import { useSettings } from '../hooks/useSettings'
// Icons imported from @ui/components/Icons
import { SettingsIcon, CloseIcon, LanguageIcon, InfoIcon, GridIcon, EyeIcon, MagicWandIcon, SelectorIcon, TerminalIcon } from '@ui/components/Icons'
// Lazy Load Settings Tabs
const LanguageTab = lazy(() => import('./LanguageTab'))
const AboutTab = lazy(() => import('./AboutTab'))
const SitesTab = lazy(() => import('./SitesTab'))
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
 * Settings modal main component
 * Headless UI + Framer Motion Premium Redesign v2
 */
function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { t } = useLanguage()
    const modalRef = useRef<HTMLDivElement>(null)
    const [activeTab, setActiveTab] = useState('prompts')

    // Read settings state/actions from the custom hook
    const settings = useSettings()

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // Close on outside click
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
        { id: 'sites', label: t('ai_sites') || 'Siteler', icon: GridIcon },
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
            case 'sites':
                return <SitesTab />
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl will-change-[opacity]"
            />

            {/* Modal Container */}
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
                <Tabs defaultValue="prompts" className="flex w-full h-full" value={activeTab} onValueChange={setActiveTab}>
                    {/* Sidebar Navigation */}
                    <aside className="relative w-60 lg:w-64 shrink-0 flex flex-col bg-black/35 border-r border-white/[0.1] max-[900px]:w-full max-[900px]:border-r-0 max-[900px]:border-b">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-transparent" />
                        {/* Header */}
                        <div className="relative p-5 md:p-6 md:pb-4">
                            <div className="flex items-center gap-3 mb-6 md:mb-8">
                                <div className="p-2.5 rounded-xl bg-gradient-to-b from-white/[0.1] to-white/[0.04] border border-white/[0.2] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md">
                                    <SettingsIcon className="w-5 h-5 text-white/70" />
                                </div>
                                <div>
                                    <h2 className="text-sm md:text-base font-bold text-white/90 tracking-tight">
                                        {t('settings_title')}
                                    </h2>
                                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-medium">
                                        {t('settings')}
                                    </p>
                                </div>
                            </div>

                            <TabsList className="flex flex-col gap-1.5 bg-transparent p-0 h-auto max-[900px]:flex-row max-[900px]:overflow-x-auto max-[900px]:pb-1">
                                {tabDefs.map((tab) => {
                                    const selected = activeTab === tab.id
                                    return (
                                        <TabsTrigger
                                            key={tab.id}
                                            value={tab.id}
                                            className={`
                                                group relative isolate overflow-hidden flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold
                                                outline-none w-full justify-start border backdrop-blur-xl transition-all duration-300
                                                ${selected
                                                    ? 'text-white border-white/[0.32] bg-gradient-to-br from-white/[0.17] via-white/[0.09] to-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_28px_-14px_rgba(255,255,255,0.35)]'
                                                    : 'text-white/50 border-white/[0.14] bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent hover:text-white/85 hover:border-white/[0.24] hover:from-white/[0.12] hover:via-white/[0.05]'
                                                }
                                                max-[900px]:w-auto max-[900px]:min-w-max
                                            `}
                                        >
                                            <>
                                                <span
                                                    className={`pointer-events-none absolute inset-[1px] rounded-[10px] transition-opacity duration-300 ${selected
                                                        ? 'opacity-100 bg-gradient-to-b from-white/[0.14] to-transparent'
                                                        : 'opacity-0 group-hover:opacity-100 bg-gradient-to-b from-white/[0.08] to-transparent'
                                                    }`}
                                                />
                                                {selected && (
                                                    <motion.span
                                                        initial={{ x: '-140%' }}
                                                        animate={{ x: '160%' }}
                                                        transition={{ duration: 2.2, ease: 'linear', repeat: Infinity, repeatDelay: 0.8 }}
                                                        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.22] to-transparent opacity-60 blur-[1px]"
                                                    />
                                                )}
                                                <tab.icon className={`relative z-10 w-4 h-4 transition-colors duration-200 ${selected ? 'text-white' : 'text-white/38 group-hover:text-white/64'}`} />
                                                <span className="relative z-10">{tab.label}</span>
                                                {selected && (
                                                    <motion.div
                                                        layoutId="active-indicator"
                                                        className="pointer-events-none absolute left-2 inset-y-2 w-px rounded-full bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.35)] max-[900px]:left-2 max-[900px]:right-2 max-[900px]:top-auto max-[900px]:bottom-1 max-[900px]:h-px max-[900px]:w-auto"
                                                    />
                                                )}
                                            </>
                                        </TabsTrigger>
                                    )
                                })}
                            </TabsList>
                        </div>

                        {/* Sidebar Footer */}
                        <div className="mt-auto p-6 pt-4 border-t border-white/[0.06] max-[900px]:hidden">
                            <div className="flex items-center gap-2.5">
                                <div className="relative">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-45" />
                                </div>
                                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                                    {t('system_ok') || 'System OK'}
                                </span>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="relative flex-1 flex flex-col min-w-0 bg-gradient-to-b from-white/[0.01] to-transparent">
                        {/* Content Header */}
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
                                        {tabDefs.find(t => t.id === activeTab)?.label}
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

                        {/* Divider */}
                        <div className="mx-6 md:mx-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                        {/* Scrollable Content */}
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
                                            {renderTabContent(tab.id)}
                                        </motion.div>
                                    </Suspense>
                                </TabsContent>
                            ))}
                        </div>
                    </main>
                </Tabs>
            </motion.div>
        </div>
    )
}

export default SettingsModal


