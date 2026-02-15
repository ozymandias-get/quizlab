import React, { useState, useMemo, useCallback } from 'react'
import { Logger } from '@src/utils/logger'
import { motion, AnimatePresence } from 'framer-motion'
import { Switch, Field, Label, Description } from '@headlessui/react'
import { useAi, useLanguage, useToast } from '@src/app/providers'
import { GridIcon, getAiIcon } from '@src/components/ui/Icons'

interface IconProps {
    className?: string;
}

// Icons
const PlusIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
)

const TrashIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
)

/**
 * AI Modelleri sekmesi bileşeni - Premium Redesign
 */
const ModelsTab = React.memo(() => {
    const { enabledModels, setEnabledModels, aiSites, refreshRegistry } = useAi()
    const { t } = useLanguage()
    const { showSuccess, showError } = useToast()

    // En az bir model seçili kalmalı
    const MIN_ENABLED_MODELS = 1

    const toggleModel = useCallback((key: string) => {
        let newModels: string[]
        if (enabledModels.includes(key)) {
            // En az bir model seçili kalmalı
            if (enabledModels.length <= MIN_ENABLED_MODELS) return
            newModels = enabledModels.filter(m => m !== key)
        } else {
            newModels = [...enabledModels, key]
        }
        setEnabledModels(newModels)
    }, [enabledModels, setEnabledModels])

    const modelsList = useMemo(() => Object.keys(aiSites), [aiSites])

    // Add Custom AI State
    const [showAddForm, setShowAddForm] = useState(false)
    const [newAiName, setNewAiName] = useState('')
    const [newAiUrl, setNewAiUrl] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const handleAddAi = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newAiName.trim() || !newAiUrl.trim()) return

        setActionLoading('add')
        try {
            const result = await window.electronAPI?.addCustomAi?.({
                name: newAiName.trim(),
                url: newAiUrl.trim()
            })

            if (result && result.success) {
                showSuccess(t('ai_added_success'))
                setNewAiName('')
                setNewAiUrl('')
                setShowAddForm(false)

                // Enable the new model by default
                const currentEnabled = [...enabledModels]
                if (result.id && !currentEnabled.includes(result.id)) {
                    currentEnabled.push(result.id)
                    setEnabledModels(currentEnabled)
                }

                await refreshRegistry(true)
            } else {
                showError(result?.error || t('ai_add_failed'))
            }
        } catch (err) {
            Logger.error(err)
            showError(t('ai_add_failed'))
        } finally {
            setActionLoading(null)
        }
    }, [newAiName, newAiUrl, enabledModels, setEnabledModels, refreshRegistry, showSuccess, showError, t])

    const handleDeleteAi = useCallback(async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation() // Prevent toggling switch
        if (!confirm(t('confirm_delete', { name }))) return

        setActionLoading(id)
        try {
            const success = await window.electronAPI?.deleteCustomAi?.(id)
            if (success) {
                showSuccess(t('ai_deleted_success'))

                // Remove from enabled list if present
                if (enabledModels.includes(id)) {
                    setEnabledModels(enabledModels.filter(m => m !== id))
                }

                await refreshRegistry(true)
            } else {
                showError(t('ai_delete_failed'))
            }
        } catch (err) {
            showError(t('ai_delete_failed'))
        } finally {
            setActionLoading(null)
        }
    }, [t, enabledModels, setEnabledModels, refreshRegistry, showSuccess, showError])

    return (
        <div className="space-y-6 pb-20">
            {/* Header & Add Button */}
            <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 border border-blue-500/20">
                        <GridIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">
                            {t('ai_settings')}
                        </p>
                        <h4 className="text-sm font-bold text-white/90 tracking-wide">
                            {t('ai_models')}
                        </h4>
                    </div>
                </div>

                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 border
                        ${showAddForm
                            ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                >
                    {showAddForm ? (
                        <>
                            <span className="text-xs font-bold">{t('cancel')}</span>
                        </>
                    ) : (
                        <>
                            <PlusIcon className="w-4 h-4" />
                            <span className="text-xs font-bold">{t('add_custom_ai')}</span>
                        </>
                    )}
                </button>
            </div>

            {/* Add AI Form */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                            opacity: 1,
                            height: 'auto',
                            transition: {
                                height: { duration: 0.3, ease: [0.25, 1, 0.5, 1] },
                                opacity: { duration: 0.2, delay: 0.1 }
                            }
                        }}
                        exit={{
                            opacity: 0,
                            height: 0,
                            transition: {
                                height: { duration: 0.2, ease: 'easeInOut' },
                                opacity: { duration: 0.1 }
                            }
                        }}
                        style={{ willChange: 'opacity, height' }}
                        onSubmit={handleAddAi}
                        className="overflow-hidden mb-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider pl-1">
                                    {t('name')}
                                </label>
                                <input
                                    type="text"
                                    value={newAiName}
                                    onChange={e => setNewAiName(e.target.value)}
                                    placeholder={t('placeholder_ai_name')}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider pl-1">
                                    {t('url')}
                                </label>
                                <input
                                    type="text"
                                    value={newAiUrl}
                                    onChange={e => setNewAiUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={actionLoading === 'add' || !newAiName || !newAiUrl}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
                            >
                                {actionLoading === 'add' ? t('adding') : t('save_platform')}
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Açıklama */}
            {!showAddForm && (
                <div className="px-1">
                    <p className="text-xs text-white/40 leading-relaxed">
                        {t('models_description')}
                    </p>
                </div>
            )}

            {/* Model Listesi */}
            <div className="grid grid-cols-1 gap-3">
                <AnimatePresence mode="popLayout">
                    {modelsList.map((key, index) => {
                        const isEnabled = enabledModels.includes(key)
                        // Don't disable dragging 'last model' if we have custom ones, but typically we want at least 1 active
                        const isLastModel = isEnabled && enabledModels.length <= MIN_ENABLED_MODELS
                        const site = aiSites[key]
                        const isCustom = site.isCustom

                        return (
                            <motion.div
                                key={key}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                            >
                                <Field
                                    className={`
                                        group relative flex items-center justify-between p-4 rounded-[20px] transition-all duration-300 border overflow-hidden
                                        ${isEnabled
                                            ? 'bg-white/[0.06] border-white/[0.12] shadow-lg'
                                            : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08]'
                                        }
                                        ${isLastModel ? 'opacity-80' : 'cursor-pointer'}
                                    `}
                                    onClick={() => !isLastModel && toggleModel(key)}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Model Icon */}
                                        <div className="relative">
                                            <div className={`
                                                p-3 rounded-2xl border transition-all duration-300
                                                ${isEnabled
                                                    ? 'bg-gradient-to-br from-white/[0.1] to-white/[0.05] border-white/20 text-white shadow-lg'
                                                    : 'bg-white/[0.02] border-white/[0.06] text-white/20'
                                                }
                                            `}>
                                                {(() => {
                                                    const icon = getAiIcon(site?.icon || key);
                                                    return icon ? icon : <GridIcon className="w-5 h-5" />;
                                                })()}
                                            </div>
                                            {/* Status Dot */}
                                            {isEnabled && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a0a0a] shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                                />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <Label className={`text-sm font-bold transition-colors duration-300 ${isEnabled ? 'text-white' : 'text-white/50'}`}>
                                                    {(() => {
                                                        const translated = t(key);
                                                        // If t(key) returns something different than key, it means we have a translation (e.g. 'chatgpt' -> 'ChatGPT')
                                                        // Note: This relies on t() returning the key if translation is missing.
                                                        if (translated && translated !== key) return translated;

                                                        return site.displayName || site.name || (key.charAt(0).toUpperCase() + key.slice(1));
                                                    })()}
                                                </Label>
                                                {isCustom && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/20">
                                                        {t('custom_badge')}
                                                    </span>
                                                )}
                                            </div>
                                            <Description className={`text-[10px] uppercase tracking-widest font-bold transition-colors duration-300 ${isEnabled ? 'text-emerald-400/60' : 'text-white/20'}`}>
                                                {isEnabled ? (t('model_active')) : (t('model_inactive'))}
                                            </Description>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Toggle Switch */}
                                        <Switch
                                            checked={isEnabled}
                                            onChange={() => !isLastModel && toggleModel(key)}
                                            disabled={isLastModel}
                                            className={`
                                                group relative flex items-center h-6 w-11 cursor-pointer rounded-full p-1 transition-all duration-300 border
                                                ${isEnabled
                                                    ? 'bg-emerald-500/20 border-emerald-500/30'
                                                    : 'bg-white/[0.04] border-white/[0.08]'
                                                }
                                                ${isLastModel ? 'cursor-not-allowed opacity-50' : ''}
                                            `}
                                        >
                                            <span
                                                className={`
                                                    pointer-events-none inline-block h-4 w-4 transform rounded-full ring-0 transition duration-300 ease-in-out shadow-sm
                                                    ${isEnabled ? 'translate-x-5 bg-emerald-500' : 'translate-x-0 bg-white/20'}
                                                `}
                                            />
                                        </Switch>

                                        {/* Delete Custom AI Button */}
                                        {isCustom && (
                                            <button
                                                onClick={(e) => handleDeleteAi(e, site.id, site.name)}
                                                disabled={!!actionLoading}
                                                className="p-2 mr-[-8px] rounded-full hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                                title={t('delete_custom_ai')}
                                            >
                                                {actionLoading === site.id ? (
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <TrashIcon className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </Field>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            {/* Footer Stats */}
            <div className="px-1 pt-4 border-t border-white/[0.04]">
                <p className="text-[10px] text-white/20 uppercase tracking-widest">
                    {t('active_models')}: {enabledModels.length} / {modelsList.length} {t('models_count')}
                </p>
            </div>
        </div>
    )
})

ModelsTab.displayName = 'ModelsTab'

export default ModelsTab

