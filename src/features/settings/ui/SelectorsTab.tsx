import React, { useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@app/providers'
import { useAiActions, useAiState } from '@app/providers/AiContext'
import { useAiConfig, useDeleteAiConfig } from '@platform/electron/api/useAiApi'
import { Logger } from '@shared/lib/logger'
import { CheckIcon, ChevronRightIcon, GlobeIcon, MagicWandIcon, TrashIcon, SelectorIcon } from '@ui/components/Icons'
import type { AiPlatform, AiSelectorConfig } from '@shared-core/types'
import SettingsTabIntro from './shared/SettingsTabIntro'
import { getAiPlatformIcon, getAiPlatformLabel } from './shared/aiPlatformPresentation'

interface SelectorsTabProps {
    onCloseSettings?: () => void;
}

function normalizeSelectorsData(selectorsData: AiSelectorConfig | Record<string, AiSelectorConfig> | null | undefined) {
    if (!selectorsData || 'input' in selectorsData) {
        return {}
    }

    return selectorsData as Record<string, AiSelectorConfig>
}

function findSelectorHost(ai: AiPlatform, selectors: Record<string, AiSelectorConfig>) {
    if (!ai.url) {
        return null
    }

    try {
        const aiHost = new URL(ai.url).hostname
        if (selectors[aiHost]) {
            return aiHost
        }

        return Object.keys(selectors).find((key) => key.includes(aiHost) || aiHost.includes(key)) ?? null
    } catch {
        return null
    }
}

/**
 * Selectors Management Tab
 * Lists enabled AI sites and allows managing their custom selectors.
 * Regular web sites (isSite: true) are not shown in this list.
 */
const SelectorsTab = React.memo(({ onCloseSettings }: SelectorsTabProps) => {
    const { aiSites } = useAiState()
    const { startTutorial } = useAiActions()
    const { t } = useLanguage()
    const { data: selectorsData } = useAiConfig()
    const { mutateAsync: deleteConfig, isPending: isDeleting } = useDeleteAiConfig()

    const selectors = useMemo(() => normalizeSelectorsData(selectorsData), [selectorsData])

    const handleDeleteSelectors = useCallback(async (hostname: string) => {
        if (!confirm(t('confirm_delete_selectors'))) {
            return
        }

        try {
            await deleteConfig(hostname)
        } catch (err) {
            Logger.error('Failed to delete selectors', err)
        }
    }, [deleteConfig, t])

    const handleStartTutorial = useCallback(() => {
        startTutorial()
        onCloseSettings?.()
    }, [onCloseSettings, startTutorial])

    const aiEntries = useMemo(
        () => Object.entries(aiSites).filter(([, ai]) => !ai.isSite),
        [aiSites]
    )

    return (
        <div className="space-y-6 pb-20">
            <SettingsTabIntro
                icon={(
                    <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-2.5 text-emerald-400">
                        <SelectorIcon className="w-5 h-5" />
                    </div>
                )}
                eyebrow={t('automation')}
                title={t('element_selectors')}
                description={t('selectors_description_simple')}
            />

            <div className="mb-4 px-1">
                <button
                    onClick={handleStartTutorial}
                    className="group flex w-full items-center gap-4 rounded-[20px] border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 transition-all hover:border-purple-500/40"
                >
                    <div className="rounded-xl bg-purple-500/20 p-2.5 text-purple-400 transition-transform group-hover:scale-110">
                        <MagicWandIcon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-bold text-white/90 transition-colors group-hover:text-purple-300">
                            {t('tutorial_button_title')}
                        </h4>
                        <p className="text-xs text-white/40 transition-colors group-hover:text-white/60">
                            {t('tutorial_button_desc')}
                        </p>
                    </div>
                    <div className="ml-auto text-purple-400 opacity-0 transition-opacity group-hover:opacity-100">
                        <ChevronRightIcon className="w-5 h-5" />
                    </div>
                </button>
            </div>

            <div className="grid gap-3">
                {aiEntries.map(([key, ai]) => {
                    const selectorHost = findSelectorHost(ai, selectors)
                    const hasSelectors = Boolean(selectorHost)

                    return (
                        <motion.div
                            key={ai.id || key}
                            layout
                            className="
                                group relative flex items-center justify-between rounded-[20px]
                                border border-white/[0.06] bg-white/[0.03] p-4 pl-5
                                transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.05]
                            "
                        >
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div
                                        className={`
                                            rounded-2xl border p-2.5 transition-all duration-300
                                            ${hasSelectors
                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                                : 'border-white/10 bg-white/5 text-white/40'
                                            }
                                        `}
                                    >
                                        {getAiPlatformIcon(ai, key, <GlobeIcon className="w-5 h-5" />)}
                                    </div>

                                    {hasSelectors && (
                                        <div className="absolute -right-1 -top-1 rounded-full border-2 border-[#121212] bg-emerald-500 p-[1px]">
                                            <CheckIcon className="w-2.5 h-2.5 text-black" strokeWidth={4} />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold text-white/90">
                                        {getAiPlatformLabel(ai, key)}
                                    </h4>
                                    <div className="mt-0.5 flex items-center gap-2">
                                        {hasSelectors ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-emerald-400">
                                                {t('selectors_active')}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-medium tracking-wide text-white/20">
                                                {t('no_selectors')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {selectorHost && (
                                    <button
                                        onClick={() => handleDeleteSelectors(selectorHost)}
                                        disabled={isDeleting}
                                        title={t('delete_selectors')}
                                        className="
                                            flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5
                                            text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-300
                                            disabled:opacity-50
                                        "
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
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
