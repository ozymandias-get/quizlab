import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAi, useLanguage, useToast } from '../../context'
import { getAiIcon, GlobeIcon, MagicWandIcon } from '../Icons'
import type { AiPlatform, AiSelectorConfig } from '../../types/global'

interface IconProps {
    className?: string;
}

// Icons
const TrashIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
)

const SelectorIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
    </svg>
)

interface SelectorsTabProps {
    onCloseSettings?: () => void;
}

/**
 * Selectors Management Tab
 * Lists enabled AI models and allows managing their custom selectors.
 */
const SelectorsTab = React.memo(({ onCloseSettings }: SelectorsTabProps) => {
    const { aiSites, startTutorial } = useAi()
    const { t } = useLanguage()
    const { showSuccess, showWarning } = useToast()

    const [selectors, setSelectors] = useState<Record<string, AiSelectorConfig>>({})
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Load selectors
    const loadSelectors = useCallback(async () => {
        try {
            const data = await window.electronAPI?.getAiConfig?.()
            if (data && typeof data === 'object' && 'input' in data) {
                setSelectors({})
            } else {
                setSelectors((data as Record<string, AiSelectorConfig>) || {})
            }
        } catch (err) {
            console.error('Failed to load selectors:', err)
        }
    }, [])

    useEffect(() => {
        loadSelectors()
    }, [loadSelectors])


    const handleDeleteSelectors = useCallback(async (hostname: string) => {
        if (!confirm(t('confirm_delete_selectors'))) return

        setActionLoading('sel_' + hostname)
        try {
            await window.electronAPI?.deleteAiConfig(hostname)
            setSelectors((prev) => {
                const newSelectors = { ...prev }
                delete newSelectors[hostname]
                return newSelectors
            })
            showSuccess(t('selectors_deleted_success'))
        } catch (err) {
            showWarning(t('selectors_delete_failed'))
        } finally {
            setActionLoading(null)
        }
    }, [t, showSuccess, showWarning])

    // Helper to find selectors for an AI
    const findSelectorHost = useCallback((ai: AiPlatform): string | null | undefined => {
        // Try to match specific hostname in selectors
        if (!ai.url) return null
        try {
            const aiHost = new URL(ai.url).hostname
            // Direct match
            if (selectors[aiHost]) return aiHost
            // Rough match in keys
            const key = Object.keys(selectors).find(k => k.includes(aiHost) || aiHost.includes(k))
            return key
        } catch {
            return null
        }
    }, [selectors])

    const aiEntries = useMemo(() => Object.entries(aiSites), [aiSites])

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <header className="px-1 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/20">
                        <SelectorIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">
                            {t('automation')}
                        </p>
                        <h4 className="text-sm font-bold text-white/90 tracking-wide">
                            {t('element_selectors')}
                        </h4>
                    </div>
                </div>
            </header>

            {/* Description */}
            <div className="px-1">
                <p className="text-xs text-white/40 leading-relaxed">
                    {t('selectors_description_simple')}
                </p>
            </div>

            {/* AI List with Selector Status */}
            <div className="px-1 mb-4">
                <button
                    onClick={() => {
                        startTutorial()
                        if (onCloseSettings) onCloseSettings()
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-[20px] bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all group"
                >
                    <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
                        <MagicWandIcon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-bold text-white/90 group-hover:text-purple-300 transition-colors">
                            {t('tutorial_button_title')}
                        </h4>
                        <p className="text-xs text-white/40 group-hover:text-white/60 transition-colors">
                            {t('tutorial_button_desc')}
                        </p>
                    </div>
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-purple-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </button>
            </div>

            <div className="grid gap-3">
                {aiEntries.map(([key, ai]: [string, AiPlatform]) => {
                    const selectorHost = findSelectorHost(ai)
                    const hasSelectors = !!selectorHost
                    const icon = getAiIcon(ai.icon || key) || <GlobeIcon className="w-5 h-5" />

                    return (
                        <motion.div
                            key={ai.id || key}
                            layout
                            className={`
                                group relative flex items-center justify-between p-4 pl-5 rounded-[20px] 
                                bg-white/[0.03] border border-white/[0.06] 
                                hover:bg-white/[0.05] hover:border-white/[0.1]
                                transition-all duration-300
                            `}
                        >
                            <div className="flex items-center gap-4">
                                {/* Icon */}
                                <div className="relative">
                                    <div className={`
                                        p-2.5 rounded-2xl border transition-all duration-300
                                        ${hasSelectors
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                            : 'bg-white/5 border-white/10 text-white/40'
                                        }
                                    `}>
                                        {icon}
                                    </div>
                                    {/* Selector Checkmark Notification */}
                                    {hasSelectors && (
                                        <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full border-2 border-[#121212] p-[1px]">
                                            <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div>
                                    <h4 className="text-sm font-bold text-white/90">
                                        {ai.displayName || ai.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {hasSelectors ? (
                                            <span className="text-[10px] font-bold text-emerald-400 tracking-wide flex items-center gap-1">
                                                {t('selectors_active')}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-medium text-white/20 tracking-wide">
                                                {t('no_selectors')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                {/* Delete Selector Button */}
                                {hasSelectors && (
                                    <button
                                        onClick={() => handleDeleteSelectors(selectorHost)}
                                        disabled={!!actionLoading}
                                        title={t('delete_selectors')}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg 
                                                 bg-red-500/10 border border-red-500/20 
                                                 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300
                                                 transition-all disabled:opacity-50"
                                    >
                                        {actionLoading === 'sel_' + selectorHost ? (
                                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        )}
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{t('reset')}</span>
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

        </div>
    )
})

SelectorsTab.displayName = 'SelectorsTab'

export default SelectorsTab
