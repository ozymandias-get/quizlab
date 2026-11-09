import type { AiPlatform } from '@shared-core/types'

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'
import {
  EmptyState,
  IconButton,
  InlineSpinner,
  SettingsRowIcon,
  WithTooltip
} from '@shared/ui/components/primitives'
import { GridIcon, RefreshIcon, TrashIcon } from '@ui/components/Icons'

import { Description, Field, Label } from '@headlessui/react'
import { CircleCheck, Globe, Search, Star } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, type MouseEvent, useMemo, useState } from 'react'

import { getAiPlatformIcon, getAiPlatformLabel } from '../shared/aiPlatformPresentation'
import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

interface AiModelListProps {
  modelsList: string[]
  enabledModels: string[]
  favoriteModels?: string[]
  toggleFavoriteModel?: (key: string) => void
  aiSites: Record<string, AiPlatform>
  toggleModel: (key: string) => void
  handleDeleteAi: (e: MouseEvent, id: string, name: string) => Promise<void>
  handleClearModelData?: (
    e: MouseEvent,
    id: string,
    name: string,
    onConfirmed?: () => void
  ) => Promise<void>
  isDeleting: boolean
  isClearingModelData?: boolean
  minEnabledModels: number
  defaultAiModel?: string
  setDefaultAiModel?: (model: string) => void
  t: (key: string) => string
}

/**
 * Row-level affordances repeat on every card, so they stay hidden at rest and
 * fade in on hover/focus instead of forming a wall of identical icons. Busy
 * rows keep their icon visible so the spinner stays readable.
 */
const HOVER_AFFORDANCE =
  'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 group-focus-visible:opacity-100 motion-reduce:opacity-100'

const AiModelList = memo(function AiModelList({
  modelsList,
  enabledModels,
  favoriteModels = [],
  toggleFavoriteModel,
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
  const { showError } = useToastActions()
  const [localDeletingId, setLocalDeletingId] = useState<string | null>(null)
  const [localClearingId, setLocalClearingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredModelsList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return modelsList
    return modelsList.filter((key) => {
      const site = aiSites[key]
      if (!site) return key.toLowerCase().includes(q)
      const name = (site.name || '').toLowerCase()
      const displayName = (site.displayName || '').toLowerCase()
      const url = (site.url || '').toLowerCase()
      return (
        key.toLowerCase().includes(q) ||
        name.includes(q) ||
        displayName.includes(q) ||
        url.includes(q)
      )
    })
  }, [modelsList, aiSites, searchQuery])

  const handleDeleteClick = async (e: MouseEvent, id: string, name: string) => {
    setLocalDeletingId(id)
    try {
      await handleDeleteAi(e, id, name)
    } catch (err) {
      Logger.error('[AiModelList] Delete failed:', err)
      showError(ensureErrorMessage(err, t('toast_ai_config_delete_failed')))
    } finally {
      setLocalDeletingId(null)
    }
  }

  const handleClearDataClick = async (e: MouseEvent, id: string, name: string) => {
    if (!handleClearModelData) return
    // The row must stay enabled while the confirmation is open: disabling it
    // first moves focus to <body>, so the shared dialog cannot restore focus
    // to the trigger when the user cancels.
    try {
      await handleClearModelData(e, id, name, () => setLocalClearingId(id))
    } catch (err) {
      Logger.error('[AiModelList] Clear model data failed:', err)
      showError(ensureErrorMessage(err, t('error_invalid_input')))
    } finally {
      setLocalClearingId(null)
    }
  }

  if (modelsList.length === 0) {
    return (
      <EmptyState
        bare
        icon={Globe}
        title={t('ai_home.empty_sites_title')}
        description={t('ai_home.empty_sites_description')}
        size="sm"
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {modelsList.length > 5 && (
        <div className="relative mb-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_ai_placeholder')}
            aria-label={t('search_ai_placeholder')}
            className="bg-card border-border/50 text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:ring-primary/20 text-ql-12 h-9 w-full rounded-xl border pr-3 pl-9 focus:ring-2 focus:outline-none"
          />
        </div>
      )}
      {filteredModelsList.length === 0 && (
        <p role="status" className="text-muted-foreground text-ql-12 py-4 text-center">
          {t('ai_catalog_no_results')}
        </p>
      )}
      <AnimatePresence mode="popLayout">
        {filteredModelsList.map((key, index) => {
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
              transition={{ delay: Math.min(index, 6) * 0.03 }}
            >
              <Field
                className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border p-4 transition-colors ${
                  isEnabled
                    ? 'border-ring/50 bg-accent/30'
                    : 'border-border/60 bg-card hover:bg-muted/50'
                } ${isLastModel ? 'opacity-80' : 'cursor-pointer'}`}
                onClick={() => !isLastModel && toggleModel(key)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <SettingsRowIcon
                      className={isEnabled ? 'bg-primary/10 text-primary' : undefined}
                    >
                      {getAiPlatformIcon(site, key, <GridIcon className="h-5 w-5" />)}
                    </SettingsRowIcon>
                    {isEnabled && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="border-background absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 bg-emerald-500"
                      />
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Label
                        className={`text-ql-13 truncate font-semibold transition-colors ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {getAiPlatformLabel(site, key, t)}
                      </Label>
                      {isCustom && (
                        <span className="text-primary border-primary/20 bg-primary/10 text-ql-10 shrink-0 rounded-lg border px-1.5 py-0.5 font-semibold uppercase">
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

                <div className="flex shrink-0 items-center gap-1.5">
                  {toggleFavoriteModel && (
                    <WithTooltip
                      label={t(
                        favoriteModels.includes(key)
                          ? 'remove_favorite_model'
                          : 'add_favorite_model'
                      )}
                    >
                      <IconButton
                        type="button"
                        size="compact"
                        variant="ghost"
                        aria-pressed={favoriteModels.includes(key)}
                        aria-label={`${t(favoriteModels.includes(key) ? 'remove_favorite_model' : 'add_favorite_model')} — ${getAiPlatformLabel(site, key, t)}`}
                        className={
                          favoriteModels.includes(key)
                            ? 'text-amber-500 dark:text-amber-400'
                            : 'text-muted-foreground'
                        }
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          toggleFavoriteModel(key)
                        }}
                      >
                        <Star fill={favoriteModels.includes(key) ? 'currentColor' : 'none'} />
                      </IconButton>
                    </WithTooltip>
                  )}
                  {isEnabled && setDefaultAiModel && defaultAiModel !== undefined && (
                    <WithTooltip
                      label={defaultAiModel === key ? t('is_default_model') : t('set_as_default')}
                    >
                      <IconButton
                        type="button"
                        size="compact"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDefaultAiModel(key)
                        }}
                        className={`group/star ${
                          defaultAiModel === key
                            ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400'
                            : `text-muted-foreground ${HOVER_AFFORDANCE}`
                        }`}
                        aria-label={
                          defaultAiModel === key ? t('is_default_model') : t('set_as_default')
                        }
                      >
                        <CircleCheck className="transition-transform group-hover/star:scale-110" />
                      </IconButton>
                    </WithTooltip>
                  )}

                  <SettingsToggleSwitch
                    aria-label={getAiPlatformLabel(site, key, t)}
                    checked={isEnabled}
                    onChange={() => !isLastModel && toggleModel(key)}
                    disabled={isLastModel}
                  />

                  {handleClearModelData && (
                    <WithTooltip label={t('clear_ai_model_data')}>
                      <IconButton
                        type="button"
                        size="compact"
                        variant="ghost"
                        onClick={(e) => handleClearDataClick(e, site.id, site.name)}
                        disabled={isClearingModelData || isCurrentlyClearing}
                        className={isCurrentlyClearing ? 'opacity-100' : HOVER_AFFORDANCE}
                        aria-label={t('clear_ai_model_data')}
                      >
                        {isCurrentlyClearing ? <InlineSpinner /> : <RefreshIcon />}
                      </IconButton>
                    </WithTooltip>
                  )}

                  {isCustom && (
                    <WithTooltip label={t('delete_custom_ai')}>
                      <IconButton
                        type="button"
                        size="compact"
                        variant="ghost"
                        onClick={(e) => handleDeleteClick(e, site.id, site.name)}
                        disabled={isDeleting || isCurrentlyDeleting}
                        className={`hover:bg-destructive/10 hover:text-destructive ${
                          isCurrentlyDeleting ? 'opacity-100' : HOVER_AFFORDANCE
                        }`}
                        aria-label={t('delete_custom_ai')}
                      >
                        {isCurrentlyDeleting ? <InlineSpinner /> : <TrashIcon />}
                      </IconButton>
                    </WithTooltip>
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
