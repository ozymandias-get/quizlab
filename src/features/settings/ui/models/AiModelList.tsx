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
                className={`group relative flex items-center justify-between overflow-hidden rounded-xl border p-4 transition-colors ${
                  isEnabled
                    ? 'border-border bg-muted/60 shadow-xs'
                    : 'border-border bg-card hover:bg-muted/40'
                } ${isLastModel ? 'opacity-80' : 'cursor-pointer'} `}
                onClick={() => !isLastModel && toggleModel(key)}
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div
                      className={`rounded-xl border p-2.5 transition-colors ${
                        isEnabled
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-border bg-muted/40 text-muted-foreground'
                      } `}
                    >
                      {getAiPlatformIcon(site, key, <GridIcon className="h-5 w-5" />)}
                    </div>
                    {isEnabled && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="border-background absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 bg-emerald-500"
                      />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label
                        className={`text-ql-13 font-semibold transition-colors ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {getAiPlatformLabel(site, key, t)}
                      </Label>
                      {isCustom && (
                        <span className="text-ql-10 border-primary/20 bg-primary/10 text-primary rounded border px-1.5 py-0.5 font-medium">
                          {t('custom_badge')}
                        </span>
                      )}
                    </div>
                    <Description
                      className={`text-ql-11 transition-colors ${isEnabled ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
                    >
                      {isEnabled ? t('model_active') : t('model_inactive')}
                    </Description>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {isEnabled && setDefaultAiModel && defaultAiModel !== undefined && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDefaultAiModel(key)
                      }}
                      className={`group/star rounded-lg p-1.5 transition-colors ${
                        defaultAiModel === key
                          ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground/40 hover:bg-muted hover:text-foreground'
                      } focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none`}
                      title={defaultAiModel === key ? t('is_default_model') : t('set_as_default')}
                      aria-label={
                        defaultAiModel === key ? t('is_default_model') : t('set_as_default')
                      }
                    >
                      <Star
                        className="h-4 w-4 transition-transform group-hover/star:scale-110"
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
                      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 rounded-lg p-1.5 opacity-60 transition-colors group-hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
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
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/40 rounded-lg p-1.5 opacity-60 transition-colors group-hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
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
