import React, { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppTools, useLanguage, useToast } from '@app/providers'
import { useAiActions, useAiState } from '@app/providers/AiContext'
import { useAiConfig, useDeleteAiConfig, useSaveAiConfig } from '@platform/electron/api/useAiApi'
import { useGenerateValidateSelectorsScript } from '@platform/electron/api/useAutomationApi'
import { Logger } from '@shared/lib/logger'
import { canonicalizeHostname, normalizeSubmitMode } from '@shared-core/selectorConfig'
import {
    CheckIcon,
    ChevronRightIcon,
    ExternalLinkIcon,
    GlobeIcon,
    LoaderIcon,
    MagicWandIcon,
    RefreshIcon,
    SelectorIcon,
    TrashIcon
} from '@ui/components/Icons'
import type {
    AiPlatform,
    AiSelectorConfig,
    AutomationConfig,
    AutomationExecutionDiagnostics,
    AutomationExecutionResult,
    SelectorHealth,
    SubmitMode
} from '@shared-core/types'
import SettingsTabIntro from './shared/SettingsTabIntro'
import { getAiPlatformIcon, getAiPlatformLabel } from './shared/aiPlatformPresentation'

interface SelectorsTabProps {
    onCloseSettings?: () => void;
}

interface SelectorEntry {
    hostname: string;
    config: AiSelectorConfig;
}

interface ValidationState {
    status: 'idle' | 'loading' | 'success' | 'error';
    error?: string | null;
    diagnostics?: AutomationExecutionDiagnostics | null;
}

const SUBMIT_MODE_OPTIONS: Array<{ value: SubmitMode; labelKey: string }> = [
    { value: 'mixed', labelKey: 'selectors_submit_mode_mixed' },
    { value: 'click', labelKey: 'selectors_submit_mode_click' },
    { value: 'enter_key', labelKey: 'selectors_submit_mode_enter_key' }
]

function normalizeSelectorsData(selectorsData: AiSelectorConfig | Record<string, AiSelectorConfig> | null | undefined) {
    if (!selectorsData || 'input' in selectorsData) {
        return {}
    }

    return selectorsData as Record<string, AiSelectorConfig>
}

function hasSelectorLocator(config?: AiSelectorConfig | null) {
    if (!config) return false

    return Boolean(
        config.input
        || config.button
        || config.inputCandidates?.length
        || config.buttonCandidates?.length
        || config.inputFingerprint
        || config.buttonFingerprint
    )
}

function findSelectorEntry(ai: AiPlatform, selectors: Record<string, AiSelectorConfig>) {
    if (!ai.url) {
        return null
    }

    try {
        const aiHost = new URL(ai.url).hostname.toLowerCase()
        const canonicalHostname = canonicalizeHostname(aiHost) || aiHost

        if (selectors[aiHost]) {
            return {
                hostname: aiHost,
                config: selectors[aiHost] as AiSelectorConfig
            } satisfies SelectorEntry
        }

        if (selectors[canonicalHostname]) {
            return {
                hostname: canonicalHostname,
                config: selectors[canonicalHostname] as AiSelectorConfig
            } satisfies SelectorEntry
        }

        const sourceMatch = Object.entries(selectors).find(([, config]) => {
            const sourceHostname = typeof config.sourceHostname === 'string'
                ? config.sourceHostname.toLowerCase()
                : null
            return sourceHostname === aiHost
        })

        if (sourceMatch) {
            const [hostname, config] = sourceMatch
            return { hostname, config }
        }

        const canonicalMatches = Object.entries(selectors).filter(([, config]) => {
            const sourceCanonical = typeof config.canonicalHostname === 'string'
                ? config.canonicalHostname.toLowerCase()
                : null
            return sourceCanonical === canonicalHostname
        })

        if (canonicalMatches.length === 1) {
            const [hostname, config] = canonicalMatches[0] || []
            if (hostname && config) {
                return { hostname, config }
            }
        }
    } catch {
        return null
    }

    return null
}

function toAutomationConfig(config: AiSelectorConfig): AutomationConfig {
    return {
        version: config.version === 2 ? 2 : undefined,
        input: typeof config.input === 'string' || config.input === null ? config.input : null,
        button: typeof config.button === 'string' || config.button === null ? config.button : null,
        waitFor: typeof config.waitFor === 'string' || config.waitFor === null ? config.waitFor : null,
        submitMode: normalizeSubmitMode(config.submitMode) || undefined,
        inputCandidates: Array.isArray(config.inputCandidates) ? config.inputCandidates : null,
        buttonCandidates: Array.isArray(config.buttonCandidates) ? config.buttonCandidates : null,
        inputFingerprint: config.inputFingerprint || null,
        buttonFingerprint: config.buttonFingerprint || null,
        sourceUrl: typeof config.sourceUrl === 'string' ? config.sourceUrl : null,
        sourceHostname: typeof config.sourceHostname === 'string' ? config.sourceHostname : null,
        canonicalHostname: typeof config.canonicalHostname === 'string' ? config.canonicalHostname : null,
        health: config.health
    }
}

function normalizeExecutionResult(value: unknown): AutomationExecutionResult | null {
    if (typeof value === 'boolean') {
        return { success: value }
    }

    if (!value || typeof value !== 'object') {
        return null
    }

    const candidate = value as Partial<AutomationExecutionResult>
    return {
        success: typeof candidate.success === 'boolean'
            ? candidate.success
            : !candidate.error,
        error: candidate.error,
        mode: candidate.mode,
        action: candidate.action,
        diagnostics: candidate.diagnostics
    }
}

function getHealthTone(health: SelectorHealth | 'missing') {
    switch (health) {
        case 'ready':
            return {
                badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                border: 'border-emerald-500/20 bg-emerald-500/[0.04]'
            }
        case 'migrated':
            return {
                badge: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
                icon: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
                border: 'border-sky-500/20 bg-sky-500/[0.04]'
            }
        case 'needs_repick':
            return {
                badge: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
                icon: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                border: 'border-amber-500/20 bg-amber-500/[0.05]'
            }
        default:
            return {
                badge: 'border-white/10 bg-white/5 text-white/45',
                icon: 'border-white/10 bg-white/5 text-white/40',
                border: 'border-white/[0.06] bg-white/[0.03]'
            }
    }
}

function getHealthLabelKey(health: SelectorHealth | 'missing') {
    switch (health) {
        case 'ready':
            return 'selectors_health_ready'
        case 'migrated':
            return 'selectors_health_migrated'
        case 'needs_repick':
            return 'selectors_health_needs_repick'
        default:
            return 'selectors_health_missing'
    }
}

const SelectorsTab = React.memo(({ onCloseSettings }: SelectorsTabProps) => {
    const { aiSites, tabs, currentAI, webviewInstance } = useAiState()
    const { startTutorial, openAiWorkspace } = useAiActions()
    const { startPickerWhenReady } = useAppTools()
    const { showError, showSuccess, showWarning } = useToast()
    const { t } = useLanguage()
    const { data: selectorsData } = useAiConfig()
    const { mutateAsync: deleteConfig, isPending: isDeleting } = useDeleteAiConfig()
    const { mutateAsync: saveAiConfig, isPending: isSaving } = useSaveAiConfig()
    const { mutateAsync: generateValidateSelectorsScript, isPending: isTesting } = useGenerateValidateSelectorsScript()
    const [expandedIds, setExpandedIds] = useState<string[]>([])
    const [validationState, setValidationState] = useState<Record<string, ValidationState>>({})

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

    const toggleExpanded = useCallback((id: string) => {
        setExpandedIds((current) => (
            current.includes(id)
                ? current.filter((entryId) => entryId !== id)
                : [...current, id]
        ))
    }, [])

    const handleSubmitModeChange = useCallback(async (hostname: string, nextMode: SubmitMode) => {
        try {
            await saveAiConfig({
                hostname,
                config: {
                    version: 2,
                    submitMode: normalizeSubmitMode(nextMode) || 'mixed'
                }
            })
        } catch (err) {
            Logger.error('Failed to update selector submit mode', err)
        }
    }, [saveAiConfig])

    const handleOpenRepick = useCallback((aiKey: string, cardId: string) => {
        setExpandedIds((current) => current.includes(cardId) ? current : [...current, cardId])
        setValidationState((current) => ({
            ...current,
            [cardId]: { status: 'idle' }
        }))

        openAiWorkspace(aiKey)
        startPickerWhenReady()
        onCloseSettings?.()
    }, [onCloseSettings, openAiWorkspace, startPickerWhenReady])

    const handleTestSelectors = useCallback(async (
        aiKey: string,
        selectorEntry: SelectorEntry | null,
        cardId: string
    ) => {
        if (!selectorEntry || !hasSelectorLocator(selectorEntry.config)) {
            const error = t('selectors_test_no_config')
            setValidationState((current) => ({
                ...current,
                [cardId]: { status: 'error', error }
            }))
            showWarning(error, t('toast_automation_title'))
            return
        }

        if (!webviewInstance || currentAI !== aiKey || typeof webviewInstance.executeJavaScript !== 'function') {
            const error = t('selectors_test_requires_active_tab')
            setValidationState((current) => ({
                ...current,
                [cardId]: { status: 'error', error }
            }))
            showWarning(error, t('toast_automation_title'))
            return
        }

        setValidationState((current) => ({
            ...current,
            [cardId]: { status: 'loading' }
        }))

        try {
            const script = await generateValidateSelectorsScript(toAutomationConfig(selectorEntry.config))
            if (!script) {
                throw new Error('validate_script_missing')
            }

            const rawResult = await webviewInstance.executeJavaScript(script)
            const result = normalizeExecutionResult(rawResult)
            const diagnostics = result?.diagnostics || null

            if (result?.success) {
                setValidationState((current) => ({
                    ...current,
                    [cardId]: {
                        status: 'success',
                        diagnostics
                    }
                }))
                showSuccess(t('selectors_test_success'), t('toast_automation_title'))
                return
            }

            const errorKey = result?.error ? `error_${result.error}` : 'selectors_test_failed'
            const errorMessage = t(errorKey)
            setValidationState((current) => ({
                ...current,
                [cardId]: {
                    status: 'error',
                    error: errorMessage,
                    diagnostics
                }
            }))
            showWarning(errorMessage, t('toast_automation_title'))
        } catch (err) {
            Logger.error('Failed to validate selectors', err)
            const errorMessage = t('selectors_test_failed')
            setValidationState((current) => ({
                ...current,
                [cardId]: {
                    status: 'error',
                    error: errorMessage
                }
            }))
            showError(errorMessage, t('toast_automation_title'))
        }
    }, [currentAI, generateValidateSelectorsScript, showError, showSuccess, showWarning, t, webviewInstance])

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
                    const cardId = ai.id || key
                    const selectorEntry = findSelectorEntry(ai, selectors)
                    const selectorConfig = selectorEntry?.config || null
                    const hasSelectors = hasSelectorLocator(selectorConfig)
                    const selectorHealth = hasSelectors
                        ? (selectorConfig?.health || 'ready')
                        : 'missing'
                    const tone = getHealthTone(selectorHealth)
                    const isExpanded = expandedIds.includes(cardId)
                    const validation = validationState[cardId] || { status: 'idle' as const }
                    const savedHost = selectorEntry?.hostname || selectorConfig?.sourceHostname || selectorConfig?.canonicalHostname || null
                    const submitMode = normalizeSubmitMode(selectorConfig?.submitMode) || 'mixed'
                    const canTestOnCurrentTab = Boolean(
                        hasSelectors
                        && webviewInstance
                        && currentAI === key
                    )
                    const existingTab = tabs.find((tab) => tab.modelId === key)

                    return (
                        <motion.div
                            key={cardId}
                            layout
                            className={`
                                group relative overflow-hidden rounded-[20px] border p-4 pl-5
                                transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.05]
                                ${tone.border}
                            `}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => toggleExpanded(cardId)}
                                    aria-expanded={isExpanded}
                                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                                >
                                    <div className="relative shrink-0">
                                        <div
                                            className={`
                                                rounded-2xl border p-2.5 transition-all duration-300
                                                ${tone.icon}
                                            `}
                                        >
                                            {getAiPlatformIcon(ai, key, <GlobeIcon className="w-5 h-5" />)}
                                        </div>

                                        {hasSelectors && selectorHealth === 'ready' && (
                                            <div className="absolute -right-1 -top-1 rounded-full border-2 border-[#121212] bg-emerald-500 p-[1px]">
                                                <CheckIcon className="w-2.5 h-2.5 text-black" strokeWidth={4} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="truncate text-sm font-bold text-white/90">
                                                {getAiPlatformLabel(ai, key)}
                                            </h4>
                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone.badge}`}>
                                                {t(getHealthLabelKey(selectorHealth))}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
                                            <span>
                                                {hasSelectors ? t('selectors_active') : t('no_selectors')}
                                            </span>
                                            {savedHost && (
                                                <span className="text-white/30">
                                                    {t('selectors_saved_host', { host: savedHost })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenRepick(key, cardId)}
                                        className="
                                            flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5
                                            text-sky-300 transition-all hover:border-sky-400/30 hover:bg-sky-500/20 hover:text-sky-200
                                        "
                                    >
                                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{t('selectors_open_repick')}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => toggleExpanded(cardId)}
                                        className="rounded-lg border border-white/10 bg-black/10 p-2 text-white/50 transition hover:border-white/20 hover:text-white/80"
                                        aria-label={isExpanded ? t('ai_send_collapse') : t('ai_send_expand')}
                                    >
                                        <ChevronRightIcon
                                            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
                                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                        <div className="space-y-2 rounded-2xl border border-white/[0.06] bg-black/10 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                                        {t('selectors_saved_host_label')}
                                                    </p>
                                                    <p className="mt-1 text-sm text-white/80">
                                                        {savedHost || t('selectors_host_unavailable')}
                                                    </p>
                                                </div>
                                                {existingTab && (
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                                                        {t('selectors_tab_ready')}
                                                    </span>
                                                )}
                                            </div>

                                            {selectorHealth === 'needs_repick' && (
                                                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                                                    {t('selectors_repick_warning')}
                                                </p>
                                            )}

                                            {!canTestOnCurrentTab && (
                                                <p className="text-xs leading-relaxed text-white/40">
                                                    {t('selectors_test_requires_active_tab')}
                                                </p>
                                            )}
                                        </div>

                                        <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                                {t('selectors_submit_mode_label')}
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {SUBMIT_MODE_OPTIONS.map((option) => {
                                                    const isActive = submitMode === option.value
                                                    return (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            disabled={!hasSelectors || isSaving}
                                                            aria-pressed={isActive}
                                                            onClick={() => selectorEntry && handleSubmitModeChange(selectorEntry.hostname, option.value)}
                                                            className={`
                                                                rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition
                                                                ${isActive
                                                                    ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
                                                                    : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/80'}
                                                                disabled:cursor-not-allowed disabled:opacity-45
                                                            `}
                                                        >
                                                            {t(option.labelKey)}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {validation.status !== 'idle' && (
                                        <div className={`
                                            rounded-2xl border px-4 py-3
                                            ${validation.status === 'success'
                                                ? 'border-emerald-500/20 bg-emerald-500/10'
                                                : validation.status === 'loading'
                                                    ? 'border-sky-500/20 bg-sky-500/10'
                                                    : 'border-red-500/20 bg-red-500/10'}
                                        `}>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                                                    {t('selectors_test_result_label')}
                                                </span>
                                                <span className={`text-sm font-semibold ${
                                                    validation.status === 'success'
                                                        ? 'text-emerald-200'
                                                        : validation.status === 'loading'
                                                            ? 'text-sky-200'
                                                            : 'text-red-200'
                                                }`}>
                                                    {validation.status === 'success'
                                                        ? t('selectors_test_success')
                                                        : validation.status === 'loading'
                                                            ? t('loading')
                                                            : (validation.error || t('selectors_test_failed'))}
                                                </span>
                                            </div>

                                            {validation.diagnostics && (
                                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                                                            {t('input_label')}
                                                        </p>
                                                        <p className="mt-1 text-sm text-white/80">
                                                            {validation.diagnostics.input.strategy}
                                                        </p>
                                                        <p className="mt-1 text-xs text-white/40">
                                                            {validation.diagnostics.input.matchedSelector || validation.diagnostics.input.requestedSelector || t('selectors_no_match')}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                                                            {t('picker_el_submit')}
                                                        </p>
                                                        <p className="mt-1 text-sm text-white/80">
                                                            {validation.diagnostics.button?.strategy || t('selectors_no_match')}
                                                        </p>
                                                        <p className="mt-1 text-xs text-white/40">
                                                            {validation.diagnostics.button?.matchedSelector || validation.diagnostics.button?.requestedSelector || t('selectors_no_match')}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={!hasSelectors || !canTestOnCurrentTab || isTesting || validation.status === 'loading'}
                                            onClick={() => handleTestSelectors(key, selectorEntry, cardId)}
                                            className="
                                                flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2
                                                text-emerald-200 transition-all hover:border-emerald-400/30 hover:bg-emerald-500/20
                                                disabled:cursor-not-allowed disabled:opacity-45
                                            "
                                        >
                                            {validation.status === 'loading'
                                                ? <LoaderIcon className="h-3.5 w-3.5" />
                                                : <RefreshIcon className="h-3.5 w-3.5" />}
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{t('selectors_test_current_tab')}</span>
                                        </button>

                                        {selectorEntry && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSelectors(selectorEntry.hostname)}
                                                disabled={isDeleting}
                                                title={t('delete_selectors')}
                                                className="
                                                    flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2
                                                    text-red-300 transition-all hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-200
                                                    disabled:cursor-not-allowed disabled:opacity-45
                                                "
                                            >
                                                <TrashIcon className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">{t('reset')}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
})

SelectorsTab.displayName = 'SelectorsTab'

export default SelectorsTab
