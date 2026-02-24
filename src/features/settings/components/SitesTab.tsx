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

const SitesTab = memo(() => {
    const { enabledModels: enabledSites, setEnabledModels: setEnabledSites, aiSites } = useAi()
    const { t } = useLanguage()

    // React Query mutation hooks
    const { mutateAsync: deleteCustomAi, isPending: isDeleting } = useDeleteCustomAi()

    const MIN_ENABLED_MODELS = 1

    const toggleModel = useCallback((key: string) => {
        let newSites: string[]
        if (enabledSites.includes(key)) {
            if (enabledSites.length <= MIN_ENABLED_MODELS) return
            newSites = enabledSites.filter((m: string) => m !== key)
        } else {
            newSites = [...enabledSites, key]
        }
        setEnabledSites(newSites)
    }, [enabledSites, setEnabledSites])

    // Filter sites (isSite === true) from aiSites
    const sitesList = useMemo(() => Object.values(aiSites).filter((site: any) => site.isSite).map(site => site.id), [aiSites])
    
    // Count only enabled items that are actually sites (exist in aiSites and isSite is true)
    const enabledSitesCount = useMemo(() => enabledSites.filter(id => aiSites[id] && aiSites[id].isSite).length, [enabledSites, aiSites])

    // State for toggling add form
    const [showAddForm, setShowAddForm] = useState(false)

    const handleDeleteAi = useCallback(async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation()
        if (!confirm(t('confirm_delete', { name }))) return

        try {
            await deleteCustomAi(id)

            // Remove from enabled sites if present
            if (enabledSites.includes(id)) {
                setEnabledSites(enabledSites.filter((m: string) => m !== id))
            }
        } catch {
            // Error already shown via toast
        }
    }, [t, enabledSites, setEnabledSites, deleteCustomAi])

    const handleAddSuccess = useCallback((id: string) => {
        // Enable the new model by default
        if (id && !enabledSites.includes(id)) {
            setEnabledSites([...enabledSites, id])
        }
    }, [enabledSites, setEnabledSites])

    return (
        <div className="space-y-6 pb-20">

            <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 border border-blue-500/20">
                        <GridIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">
                            {t('site_settings')}
                        </p>
                        <h4 className="text-sm font-bold text-white/90 tracking-wide">
                            {t('ai_sites')}
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
                            <span className="text-xs font-bold">{t('add_site')}</span>
                        </>
                    )}
                </button>
            </div>

            {/* Add Site Form */}
            <AddAiModelForm
                showAddForm={showAddForm}
                setShowAddForm={setShowAddForm}
                onSuccess={handleAddSuccess}
                t={t}
                isSite={true}
            />

            {/* Description */}
            {!showAddForm && (
                <div className="px-1">
                    <p className="text-xs text-white/40 leading-relaxed">
                        {t('sites_description')}
                    </p>
                </div>
            )}

            {/* Model List */}
            <AiModelList
                modelsList={sitesList}
                enabledModels={enabledSites}
                aiSites={aiSites}
                toggleModel={toggleModel}
                handleDeleteAi={handleDeleteAi}
                isDeleting={isDeleting}
                minEnabledModels={MIN_ENABLED_MODELS}
                t={t}
            />

            {/* Stats area */}
            <div className="flex border-t border-white/10 p-4">
                <p className="flex items-center gap-2 text-sm text-white/50 w-1/2 justify-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    {t('active_sites')}: {enabledSitesCount} / {sitesList.length} {t('sites_count')}
                </p>
                <div className="w-px bg-white/10 mx-2"></div>
                <p className="flex items-center gap-2 text-sm text-white/50 w-1/2 justify-center">
                    <GridIcon className="w-4 h-4" />
                    {t('total')}: {sitesList.length} {t('sites_count')}
                </p>
            </div>
        </div>
    )
})

SitesTab.displayName = 'SitesTab'

export default SitesTab


