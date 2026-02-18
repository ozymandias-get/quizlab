
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Switch, Field, Label, Description } from '@headlessui/react'
import { GridIcon, getAiIcon } from '@src/components/ui/Icons'
import type { AiPlatform } from '@shared/types'

interface IconProps {
    className?: string;
}

const TrashIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
)

interface AiModelListProps {
    modelsList: string[];
    enabledModels: string[];
    aiSites: Record<string, AiPlatform>;
    toggleModel: (key: string) => void;
    handleDeleteAi: (e: React.MouseEvent, id: string, name: string) => Promise<void>;
    isDeleting: boolean;
    minEnabledModels: number;
    t: (key: string) => string;
}

export const AiModelList: React.FC<AiModelListProps> = ({
    modelsList,
    enabledModels,
    aiSites,
    toggleModel,
    handleDeleteAi,
    isDeleting,
    minEnabledModels,
    t
}) => {
    // Track local deleting state to show spinner on specific item
    const [localDeletingId, setLocalDeletingId] = useState<string | null>(null)

    const onDeleteClick = async (e: React.MouseEvent, id: string, name: string) => {
        setLocalDeletingId(id)
        await handleDeleteAi(e, id, name)
        setLocalDeletingId(null)
    }

    return (
        <div className="grid grid-cols-1 gap-3">
            <AnimatePresence mode="popLayout">
                {modelsList.map((key, index) => {
                    const isEnabled = enabledModels.includes(key)
                    const isLastModel = isEnabled && enabledModels.length <= minEnabledModels
                    const site = aiSites[key]
                    const isCustom = site.isCustom
                    const isCurrentlyDeleting = localDeletingId === site.id

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
                                            onClick={(e) => onDeleteClick(e, site.id, site.name)}
                                            disabled={isDeleting || isCurrentlyDeleting}
                                            className="p-2 mr-[-8px] rounded-full hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                            title={t('delete_custom_ai')}
                                        >
                                            {isCurrentlyDeleting ? (
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
    )
}
