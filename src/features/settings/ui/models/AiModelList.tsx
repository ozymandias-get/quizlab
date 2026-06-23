import type { AiPlatform } from '@shared-core/types'

import { GridIcon, RefreshIcon, TrashIcon } from '@ui/components/Icons'

import { Description, Field, Label } from '@headlessui/react'
import { Star } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, type MouseEvent, useState } from 'react'

import { getAiPlatformIcon, getAiPlatformLabel } from '../shared/aiPlatformPresentation'
import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

interface AiModelListProps {
  modelsList: string[]
  enabledModels: string[]
  aiSites: Record<string, AiPlatform>
  toggleModel: (key: string) => void
  handleDeleteAi: (e: MouseEvent, id: string, name: string) => Promise<void>
  handleClearModelData?: (e: MouseEvent, id: string, name: string) => Promise<void>
  isDeleting: boolean
  isClearingModelData?: boolean
  minEnabledModels: number
  defaultAiModel?: string
  setDefaultAiModel?: (model: string) => void
  t: (key: string) => string
}

const AiModelList = memo(function AiModelList({
  modelsList,
  enabledModels,
  aiSites,
  toggleModel,
  handleDeleteAi,
  handleClearModelData,
  isDeleting,
  isClearingModelData,
  minEnabledModels,
  defaultAiModel,
  setDefaultAiModel,
  t
}: AiModelListProps) {
  const [localDeletingId, setLocalDeletingId] = useState<string | null>(null)
  const [localClearingId, setLocalClearingId] = useState<string | null>(null)

  const handleDeleteClick = async (e: MouseEvent, id: string, name: string) => {
    setLocalDeletingId(id)
    try {
      await handleDeleteAi(e, id, name)
    } catch {
    } finally {
      setLocalDeletingId(null)
    }
  }

  const handleClearDataClick = async (e: MouseEvent, id: string, name: string) => {
    if (!handleClearModelData) return
    setLocalClearingId(id)
    try {
      await handleClearModelData(e, id, name)
    } catch {
    } finally {
      setLocalClearingId(null)
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
          const isCurrentlyClearing = localClearingId === site.id

          return (
            <motion.div
              key={key}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Field
                className={`group relative flex items-center justify-between overflow-hidden rounded-[20px] border p-4 transition-colors duration-300 ${
                  isEnabled
                    ? 'border-white/[0.12] bg-white/[0.06] shadow-lg'
                    : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]'
                } ${isLastModel ? 'opacity-80' : 'cursor-pointer'} `}
                onClick={() => !isLastModel && toggleModel(key)}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div
                      className={`rounded-2xl border p-3 transition-colors duration-300 ${
                        isEnabled
                          ? 'border-white/20 bg-gradient-to-br from-white/[0.1] to-white/[0.05] text-white shadow-lg'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/20'
                      } `}
                    >
                      {getAiPlatformIcon(site, key, <GridIcon className="h-5 w-5" />)}
                    </div>
                    {isEnabled && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-[var(--color-bg-primary,#0a0a0a)] bg-emerald-500 shadow-[0_0_8px_oklch(0.7_0.15_160/0.6)]"
                      />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label
                        className={`text-ql-14 font-bold transition-colors duration-300 ${isEnabled ? 'text-white' : 'text-white/50'}`}
                      >
                        {getAiPlatformLabel(site, key, t)}
                      </Label>
                      {isCustom && (
                        <span className="text-ql-10 rounded border border-blue-500/20 bg-blue-500/20 px-1.5 py-0.5 font-medium text-blue-300">
                          {t('custom_badge')}
                        </span>
                      )}
                    </div>
                    <Description
                      className={`text-ql-10 tracking-ql-fine font-medium transition-colors duration-300 ${isEnabled ? 'text-emerald-400/60' : 'text-white/24'}`}
                    >
                      {isEnabled ? t('model_active') : t('model_inactive')}
                    </Description>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isEnabled && setDefaultAiModel && defaultAiModel !== undefined && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDefaultAiModel(key)
                      }}
                      className={`group/star rounded-full p-1.5 transition-colors duration-300 ${
                        defaultAiModel === key
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-white/20 hover:bg-white/5 hover:text-white/60'
                      } focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none`}
                      title={defaultAiModel === key ? t('is_default_model') : t('set_as_default')}
                      aria-label={
                        defaultAiModel === key ? t('is_default_model') : t('set_as_default')
                      }
                    >
                      <Star
                        className="h-5 w-5 transition-transform group-hover/star:scale-110"
                        fill={defaultAiModel === key ? 'currentColor' : 'none'}
                      />
                    </button>
                  )}

                  <SettingsToggleSwitch
                    checked={isEnabled}
                    onChange={() => !isLastModel && toggleModel(key)}
                    disabled={isLastModel}
                  />

                  {handleClearModelData && (
                    <button
                      type="button"
                      onClick={(e) => handleClearDataClick(e, site.id, site.name)}
                      disabled={isClearingModelData || isCurrentlyClearing}
                      className="focus-visible:ring-ring rounded-full p-2 text-white/20 opacity-[0.55] transition-colors group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-amber-500/20 hover:text-amber-300 focus-visible:ring-2 focus-visible:outline-none"
                      title={t('clear_ai_model_data')}
                      aria-label={t('clear_ai_model_data')}
                    >
                      {isCurrentlyClearing ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <RefreshIcon className="h-4 w-4" />
                      )}
                    </button>
                  )}

                  {isCustom && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, site.id, site.name)}
                      disabled={isDeleting || isCurrentlyDeleting}
                      className="focus-visible:ring-ring mr-[-8px] rounded-full p-2 text-white/20 opacity-[0.55] transition-colors group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 focus-visible:ring-2 focus-visible:outline-none"
                      title={t('delete_custom_ai')}
                      aria-label={t('delete_custom_ai')}
                    >
                      {isCurrentlyDeleting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <TrashIcon className="h-4 w-4" />
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
})

export default AiModelList
