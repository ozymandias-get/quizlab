import type { AiPlatform } from '@shared-core/types'

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'
import { EmptyState } from '@shared/ui/components/primitives'

import { Globe, Search } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { memo, type MouseEvent, useCallback, useMemo, useRef, useState } from 'react'

import AiModelRow from './AiModelRow'

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

interface LatestHandlers {
  aiSites: Record<string, AiPlatform>
  toggleModel: (key: string) => void
  toggleFavoriteModel?: (key: string) => void
  setDefaultAiModel?: (model: string) => void
  handleDeleteAi: (e: MouseEvent, id: string, name: string) => Promise<void>
  handleClearModelData?: (
    e: MouseEvent,
    id: string,
    name: string,
    onConfirmed?: () => void
  ) => Promise<void>
  t: (key: string) => string
}

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

  // The row list must receive stable action identities for memo to work. The
  // latest props are mirrored into a ref so the callbacks can stay constant
  // without going stale.
  const latest = useRef<LatestHandlers>({
    aiSites,
    toggleModel,
    toggleFavoriteModel,
    setDefaultAiModel,
    handleDeleteAi,
    handleClearModelData,
    t
  })
  latest.current = {
    aiSites,
    toggleModel,
    toggleFavoriteModel,
    setDefaultAiModel,
    handleDeleteAi,
    handleClearModelData,
    t
  }

  const enabledSet = useMemo(() => new Set(enabledModels), [enabledModels])
  const favoriteSet = useMemo(() => new Set(favoriteModels), [favoriteModels])

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

  const handleToggle = useCallback((key: string) => {
    latest.current.toggleModel(key)
  }, [])

  const handleToggleFavorite = useCallback((key: string) => {
    latest.current.toggleFavoriteModel?.(key)
  }, [])

  const handleSetDefault = useCallback((key: string) => {
    latest.current.setDefaultAiModel?.(key)
  }, [])

  const handleDelete = useCallback(
    async (event: MouseEvent, key: string) => {
      const site = latest.current.aiSites[key]
      if (!site) return
      setLocalDeletingId(site.id)
      try {
        await latest.current.handleDeleteAi(event, site.id, site.name)
      } catch (err) {
        Logger.error('[AiModelList] Delete failed:', err)
        showError(ensureErrorMessage(err, latest.current.t('toast_ai_config_delete_failed')))
      } finally {
        setLocalDeletingId(null)
      }
    },
    [showError]
  )

  const handleClear = useCallback(
    async (event: MouseEvent, key: string) => {
      const { aiSites: sites, handleClearModelData: clearModelData } = latest.current
      if (!clearModelData) return
      const site = sites[key]
      if (!site) return
      // The row must stay enabled while the confirmation is open: disabling it
      // first moves focus to <body>, so the shared dialog cannot restore focus
      // to the trigger when the user cancels.
      try {
        await clearModelData(event, site.id, site.name, () => setLocalClearingId(site.id))
      } catch (err) {
        Logger.error('[AiModelList] Clear model data failed:', err)
        showError(ensureErrorMessage(err, latest.current.t('error_invalid_input')))
      } finally {
        setLocalClearingId(null)
      }
    },
    [showError]
  )

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
          const isEnabled = enabledSet.has(key)
          const isLastModel = isEnabled && enabledModels.length <= minEnabledModels
          return (
            <AiModelRow
              key={key}
              modelKey={key}
              site={aiSites[key]}
              isEnabled={isEnabled}
              isLastModel={isLastModel}
              isFavorite={favoriteSet.has(key)}
              isDefault={defaultAiModel === key}
              canFavorite={!!toggleFavoriteModel}
              canClear={!!handleClearModelData}
              canSetDefault={!!setDefaultAiModel && defaultAiModel !== undefined}
              isDeleting={isDeleting}
              isClearingModelData={!!isClearingModelData}
              isCurrentlyDeleting={localDeletingId === aiSites[key].id}
              isCurrentlyClearing={localClearingId === aiSites[key].id}
              searchQuery={searchQuery}
              animationDelay={Math.min(index, 6) * 0.03}
              t={t}
              onToggle={handleToggle}
              onToggleFavorite={handleToggleFavorite}
              onSetDefault={handleSetDefault}
              onDelete={handleDelete}
              onClear={handleClear}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
})

export default AiModelList
