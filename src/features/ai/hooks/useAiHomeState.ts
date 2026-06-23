import {
  useAiModelActions,
  useAiModelsCatalog,
  useAiTabsSliceState
} from '@app/providers/AiContext'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getEnabledAiIdsByType, mergeOrderedIds } from '../model/home'
import { useAiHomeLayout } from './useAiHomeLayout'
import { useGridDragReorder } from './useGridDragReorder'

export function useAiHomeState() {
  const { tabs, activeTabId } = useAiTabsSliceState()
  const { aiSites = {}, enabledModels = [] } = useAiModelsCatalog()
  const { setEnabledModels } = useAiModelActions()
  const pageRef = useRef<HTMLDivElement>(null)
  const layout = useAiHomeLayout(pageRef)
  const enabledModelsRef = useRef(enabledModels)
  enabledModelsRef.current = enabledModels

  const modelIds = useMemo(
    () => getEnabledAiIdsByType(enabledModels, aiSites, 'model'),
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
      setEnabledModels([...newOrder, ...current.filter((id) => aiSites[id]?.isSite)])
    },
    [aiSites, setEnabledModels]
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
