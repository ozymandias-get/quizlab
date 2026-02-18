import React, { useState, useMemo, useCallback, memo } from 'react'
import { useAi, useLanguage } from '@src/app/providers'
import { GridIcon } from '@src/components/ui/Icons'
import { useDeleteCustomAi } from '@platform/electron/api/useAiApi'

// Sub-components
import { AddAiModelForm } from './models/AddAiModelForm'
import { AiModelList } from './models/AiModelList'

interface IconProps {
    className?: string;
}

const PlusIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
)

const ModelsTab = memo(() => {
    const { enabledModels, setEnabledModels, aiSites } = useAi()
    const { t } = useLanguage()

    // React Query mutation hooks
    const { mutateAsync: deleteCustomAi, isPending: isDeleting } = useDeleteCustomAi()

    const MIN_ENABLED_MODELS = 1

    const toggleModel = useCallback((key: string) => {
        let newModels: string[]
        if (enabledModels.includes(key)) {
            if (enabledModels.length <= MIN_ENABLED_MODELS) return
            newModels = enabledModels.filter(m => m !== key)
        } else {
            newModels = [...enabledModels, key]
        }
        setEnabledModels(newModels)
    }, [enabledModels, setEnabledModels])

    const modelsList = useMemo(() => Object.keys(aiSites), [aiSites])

    // State for toggling add form
    const [showAddForm, setShowAddForm] = useState(false)

    const handleDeleteAi = useCallback(async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation()
        if (!confirm(t('confirm_delete', { name }))) return

        try {
            await deleteCustomAi(id)

            // Remove from enabled models if present
            if (enabledModels.includes(id)) {
                setEnabledModels(enabledModels.filter(m => m !== id))
            }
        } catch {
            // Error already shown via toast
        }
    }, [t, enabledModels, setEnabledModels, deleteCustomAi])

    const handleAddSuccess = useCallback((id: string) => {
        // Enable the new model by default
        if (id && !enabledModels.includes(id)) {
            setEnabledModels([...enabledModels, id])
        }
    }, [enabledModels, setEnabledModels])

    return (
        <div className="space-y-6 pb-20">

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
            <AddAiModelForm
                showAddForm={showAddForm}
                setShowAddForm={setShowAddForm}
                onSuccess={handleAddSuccess}
                t={t}
            />

            {/* Description */}
            {!showAddForm && (
                <div className="px-1">
                    <p className="text-xs text-white/40 leading-relaxed">
                        {t('models_description')}
                    </p>
                </div>
            )}

            {/* Model List */}
            <AiModelList
                modelsList={modelsList}
                enabledModels={enabledModels}
                aiSites={aiSites}
                toggleModel={toggleModel}
                handleDeleteAi={handleDeleteAi}
                isDeleting={isDeleting}
                minEnabledModels={MIN_ENABLED_MODELS}
                t={t}
            />

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


