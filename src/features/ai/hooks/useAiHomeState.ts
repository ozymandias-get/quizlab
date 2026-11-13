import {
  useAiModelActions,
  useAiModelsCatalog,
  useAiTabsSliceState
} from '@app/providers/ai-context'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getEnabledAiIdsByType, mergeOrderedIds } from '../model/home'
import { useAiHomeLayout } from './useAiHomeLayout'
import { useGridDragReorder } from './useGridDragReorder'

export function useAiHomeState() {
  const { tabs, activeTabId } = useAiTabsSliceState()
  const { aiSites = {}, enabledModels = [], favoriteModels = [] } = useAiModelsCatalog()
  const { setEnabledModels, setFavoriteModels } = useAiModelActions()
  const pageRef = useRef<HTMLDivElement>(null)
  const layout = useAiHomeLayout(pageRef)
  const enabledModelsRef = useRef(enabledModels)
  enabledModelsRef.current = enabledModels
  const favoriteModelsRef = useRef(favoriteModels)
  favoriteModelsRef.current = favoriteModels

  const modelIds = useMemo(
    () =>
      mergeOrderedIds(
        enabledModels,
        Object.keys(aiSites).filter((id) => aiSites[id] && !aiSites[id].isSite && id !== 'api-chat')
      ),
    [aiSites, enabledModels]
  )
  const siteIds = useMemo(
    () => getEnabledAiIdsByType(enabledModels, aiSites, 'site'),
    [aiSites, enabledModels]
  )

  const [modelOrder, setModelOrder] = useState<string[]>(modelIds)
  const [siteOrder, setSiteOrder] = useState<string[]>(siteIds)

  const modelIdsKey = useMemo(() => modelIds.join('|'), [modelIds])
  const siteIdsKey = useMemo(() => siteIds.join('|'), [siteIds])

  useEffect(() => {
    setModelOrder((previous) => mergeOrderedIds(previous, modelIds))
  }, [modelIdsKey, modelIds])

  useEffect(() => {
    setSiteOrder((previous) => mergeOrderedIds(previous, siteIds))
  }, [siteIdsKey, siteIds])

  // Stable Set — only recreated when `tabs` actually changes content.
  // The `useMemo` ensures the Set reference stays the same when `tabs`
  // array length changes but the modelId set is identical (e.g. a tab
  // is reordered), preventing unnecessary re-renders in AiHomeCardGrid.
  const activeModelIds = useMemo(() => new Set(tabs.map((tab) => tab.modelId)), [tabs])

  const handleModelReorder = useCallback(
    (newOrder: string[]) => {
      setModelOrder(newOrder)
      const current = enabledModelsRef.current
      // Reordering the catalogue must never switch on its disabled entries.
      setEnabledModels([
        ...newOrder.filter((id) => current.includes(id)),
        ...current.filter((id) => !newOrder.includes(id))
      ])
    },
    [setEnabledModels]
  )

  const handleSiteReorder = useCallback(
    (newOrder: string[]) => {
      setSiteOrder(newOrder)
      const current = enabledModelsRef.current
      setEnabledModels([...current.filter((id) => aiSites[id] && !aiSites[id].isSite), ...newOrder])
    },
    [aiSites, setEnabledModels]
  )

  const modelDrag = useGridDragReorder(modelOrder, handleModelReorder)
  const siteDrag = useGridDragReorder(siteOrder, handleSiteReorder)
  const favoriteOrder = useMemo(
    () =>
      favoriteModels.filter(
        (id) => enabledModels.includes(id) && aiSites[id] && !aiSites[id].isSite
      ),
    [favoriteModels, enabledModels, aiSites]
  )
  const handleFavoriteReorder = useCallback(
    (order: string[]) => {
      const current = favoriteModelsRef.current
      setFavoriteModels([...order, ...current.filter((id) => !order.includes(id))])
    },
    [setFavoriteModels]
  )
  const favoriteDrag = useGridDragReorder(favoriteOrder, handleFavoriteReorder)
  const enableModel = useCallback(
    (id: string) => {
      if (!Object.hasOwn(aiSites, id) || !aiSites[id]) return
      const current = enabledModelsRef.current
      if (!current.includes(id)) {
        const next = [...current, id]
        enabledModelsRef.current = next
        setEnabledModels(next)
      }
    },
    [aiSites, setEnabledModels]
  )

  // Memoize the entire return to prevent consumers (AiHomePage) from
  // re-rendering when AiContext values change but the derived state
  // hasn't actually changed. Without this, every aiViewRequestNonce
  // change at the context level propagates through useAiTabsSliceState
  // into useAiHomeState and creates a new return object.
  return useMemo(
    () => ({
      activeModelIds,
      activeTabId,
      aiSites,
      enableModel,
      favoriteOrder,
      favoriteDrag,
      cardColumns: layout.cardColumns,
      isCompact: layout.isCompact,
      modelDrag,
      modelOrder,
      pageRef,
      siteDrag,
      siteOrder,
      tabs
    }),
    [
      activeModelIds,
      activeTabId,
      aiSites,
      enableModel,
      favoriteOrder,
      favoriteDrag,
      layout.cardColumns,
      layout.isCompact,
      modelDrag,
      modelOrder,
      pageRef,
      siteDrag,
      siteOrder,
      tabs
    ]
  )
}
