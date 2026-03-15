import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Field, Label, Description } from '@headlessui/react'
import { GridIcon, TrashIcon } from '@ui/components/Icons'
import type { AiPlatform } from '@shared-core/types'
import { getAiPlatformIcon, getAiPlatformLabel } from '../shared/aiPlatformPresentation'
import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

const StarIcon = ({ className, filled }: { className?: string; filled?: boolean }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

interface AiModelListProps {
  modelsList: string[]
  enabledModels: string[]
  aiSites: Record<string, AiPlatform>
  toggleModel: (key: string) => void
  handleDeleteAi: (e: React.MouseEvent, id: string, name: string) => Promise<void>
  isDeleting: boolean
  minEnabledModels: number
  defaultAiModel?: string
  setDefaultAiModel?: (model: string) => void
  t: (key: string) => string
}

export const AiModelList: React.FC<AiModelListProps> = ({
  modelsList,
  enabledModels,
  aiSites,
  toggleModel,
  handleDeleteAi,
  isDeleting,
  minEnabledModels,
  defaultAiModel,
  setDefaultAiModel,
  t
}) => {
  // Track local deleting state to show spinner on specific item
  const [localDeletingId, setLocalDeletingId] = useState<string | null>(null)

  const onDeleteClick = async (e: React.MouseEvent, id: string, name: string) => {
    setLocalDeletingId(id)
    try {
      await handleDeleteAi(e, id, name)
    } catch {
      // Parent handlers surface delete failures when needed.
    } finally {
      setLocalDeletingId(null)
    }
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
                                    ${
                                      isEnabled
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
                    <div
                      className={`
                                            p-3 rounded-2xl border transition-all duration-300
                                            ${
                                              isEnabled
                                                ? 'bg-gradient-to-br from-white/[0.1] to-white/[0.05] border-white/20 text-white shadow-lg'
                                                : 'bg-white/[0.02] border-white/[0.06] text-white/20'
                                            }
                                        `}
                    >
                      {getAiPlatformIcon(site, key, <GridIcon className="w-5 h-5" />)}
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
                      <Label
                        className={`text-sm font-bold transition-colors duration-300 ${isEnabled ? 'text-white' : 'text-white/50'}`}
                      >
                        {getAiPlatformLabel(site, key, t)}
                      </Label>
                      {isCustom && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/20">
                          {t('custom_badge')}
                        </span>
                      )}
                    </div>
                    <Description
                      className={`text-[10px] uppercase tracking-widest font-bold transition-colors duration-300 ${isEnabled ? 'text-emerald-400/60' : 'text-white/20'}`}
                    >
                      {isEnabled ? t('model_active') : t('model_inactive')}
                    </Description>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Default Model Button */}
                  {isEnabled && setDefaultAiModel && defaultAiModel !== undefined && (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDefaultAiModel(key)
                      }}
                      className={`p-1.5 rounded-full transition-all duration-300 group/star
                                                ${
                                                  defaultAiModel === key
                                                    ? 'text-yellow-400 hover:text-yellow-300'
                                                    : 'text-white/20 hover:text-white/60 hover:bg-white/5'
                                                }`}
                      title={defaultAiModel === key ? t('is_default_model') : t('set_as_default')}
                    >
                      <StarIcon
                        className="w-5 h-5 transition-transform group-hover/star:scale-110"
                        filled={defaultAiModel === key}
                      />
                    </button>
                  )}

                  {/* Toggle Switch */}
                  <SettingsToggleSwitch
                    checked={isEnabled}
                    onChange={() => !isLastModel && toggleModel(key)}
                    disabled={isLastModel}
                  />

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
