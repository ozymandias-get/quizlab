import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useAiModelsCatalog,
  useAiCoreWorkspaceActions,
  useAiTabsSliceState
} from '@app/providers/AiContext'
import { getEnabledAiIdsByType, getFeaturedAiIds, mergeOrderedIds } from '../model/home'
import { useGridDragReorder } from './useGridDragReorder'
import { useAiHomeLayout } from './useAiHomeLayout'

export function useAiHomeState() {
  const { tabs, activeTabId } = useAiTabsSliceState()
  const { aiSites = {}, enabledModels = [] } = useAiModelsCatalog()
  const { setEnabledModels } = useAiCoreWorkspaceActions()
  const pageRef = useRef<HTMLDivElement>(null)
  const layout = useAiHomeLayout(pageRef)

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

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId), [activeTabId, tabs])
  const activeModelIds = useMemo(() => new Set(tabs.map((tab) => tab.modelId)), [tabs])
  const featuredIds = useMemo(
    () => getFeaturedAiIds(modelOrder, siteOrder),
    [modelOrder, siteOrder]
  )

  const handleModelReorder = useCallback(
    (newOrder: string[]) => {
      setModelOrder(newOrder)
      setEnabledModels([...newOrder, ...enabledModels.filter((id) => aiSites[id]?.isSite)])
    },
    [aiSites, enabledModels, setEnabledModels]
  )

  const handleSiteReorder = useCallback(
    (newOrder: string[]) => {
      setSiteOrder(newOrder)
      setEnabledModels([
        ...enabledModels.filter((id) => aiSites[id] && !aiSites[id].isSite),
        ...newOrder
      ])
    },
    [aiSites, enabledModels, setEnabledModels]
  )

  const modelDrag = useGridDragReorder(modelOrder, handleModelReorder)
  const siteDrag = useGridDragReorder(siteOrder, handleSiteReorder)

  return {
    activeModelIds,
    activeTab,
    activeTabId,
    aiSites,
    cardColumns: layout.cardColumns,
    featuredIds,
    isCompact: layout.isCompact,
    isNarrow: layout.isNarrow,
    isUltraNarrow: layout.isUltraNarrow,
    modelDrag,
    modelOrder,
    pageRef,
    siteDrag,
    siteOrder,
    tabs
  }
}
