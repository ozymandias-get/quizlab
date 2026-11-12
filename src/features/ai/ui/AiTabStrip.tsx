import {
  useAiContentHostActions,
  useAiContentPresence,
  useAiSites,
  useAiTabActions,
  useAiTabsSliceState
} from '@app/providers/ai-context'
import { useTabStripReorder } from '@shared/hooks'
import { TabStripHomeButton } from '@shared/ui/components/primitives'
import {
  TAB_STRIP_BAR_CLASS,
  TAB_STRIP_DIVIDER_CLASS,
  TAB_STRIP_ROW_CLASS
} from '@shared/ui/tabStripChrome'

import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import AiOverflowMenu from './aiTabStrip/AiOverflowMenu'
import AiTabContextMenu from './aiTabStrip/AiTabContextMenu'
import AiTabStripRefreshButton from './aiTabStrip/AiTabStripRefreshButton'
import AiVisibleTabButton from './aiTabStrip/AiVisibleTabButton'
import { useAiTabStripState } from './aiTabStrip/useAiTabStripState'

interface AiTabStripProps {
  showHome?: boolean
  onShowHome?: () => void
  onHideHome?: () => void
}

function AiTabStrip({ showHome, onShowHome, onHideHome }: AiTabStripProps) {
  const { tabs, activeTabId } = useAiTabsSliceState()
  const aiSites = useAiSites()
  const { hasActiveContent } = useAiContentPresence()
  const { setActiveTab, closeTab, moveTab } = useAiTabActions()
  const { reloadActiveContent } = useAiContentHostActions()
  const { t } = useTranslation()
  const { refs, state, helpers, actions } = useAiTabStripState({
    tabs,
    activeTabId,
    aiSites,
    t
  })
  const { draggedId, dropTarget, rowDragHandlers } = useTabStripReorder({ onReorder: moveTab })

  const handleSelectTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId)
      onHideHome?.()
    },
    [setActiveTab, onHideHome]
  )

  const handleOverflowSelectTab = useCallback(
    (tabId: string) => {
      handleSelectTab(tabId)
      actions.setIsOverflowOpen(false)
    },
    [handleSelectTab, actions]
  )

  const handleToggleOverflow = useCallback(() => {
    actions.setIsOverflowOpen((prev: boolean) => !prev)
  }, [actions])

  const getIconKey = useCallback(
    (tab: (typeof tabs)[number]) => aiSites[tab.modelId]?.icon || tab.modelId,
    [aiSites]
  )

  const handleDismissContextMenu = useCallback(() => {
    actions.setContextMenu(null)
  }, [actions])

  return (
    <div className={TAB_STRIP_BAR_CLASS}>
      <div ref={refs.rowRef} className={TAB_STRIP_ROW_CLASS} {...rowDragHandlers}>
        <TabStripHomeButton isActive={showHome} tooltip={t('ai_home.home')} onClick={onShowHome} />

        <AiTabStripRefreshButton
          disabled={Boolean(showHome) || tabs.length === 0 || !hasActiveContent}
          title={t('ai_home.refresh_page')}
          onRefresh={reloadActiveContent}
        />

        <div className={TAB_STRIP_DIVIDER_CLASS} aria-hidden />

        {state.visibleTabs.map((tab) => (
          <AiVisibleTabButton
            key={tab.id}
            tab={tab}
            label={helpers.getTabLabel(tab)}
            isActive={tab.id === activeTabId}
            isDragging={draggedId === tab.id}
            dropSide={
              dropTarget?.tabId === tab.id ? (dropTarget.placeAfter ? 'after' : 'before') : null
            }
            tr={helpers.tr}
            iconKey={aiSites[tab.modelId]?.icon || tab.modelId}
            onSelect={handleSelectTab}
            onContextMenu={actions.handleOpenContextMenu}
            onClose={closeTab}
          />
        ))}

        <AiOverflowMenu
          overflowTabs={state.overflowTabs}
          overflowRef={refs.overflowRef}
          isOverflowOpen={state.isOverflowOpen}
          tr={helpers.tr}
          getTabLabel={helpers.getTabLabel}
          getIconKey={getIconKey}
          onToggleOpen={handleToggleOverflow}
          onSelectTab={handleOverflowSelectTab}
          onContextMenu={actions.handleOpenContextMenu}
          onCloseTab={closeTab}
        />
      </div>

      <AiTabContextMenu
        contextMenu={state.contextMenu}
        contextMenuTab={state.contextMenuTab}
        tabsCount={tabs.length}
        contextMenuRef={refs.contextMenuRef}
        triggerRef={refs.contextMenuTriggerRef}
        tr={helpers.tr}
        onCloseTab={closeTab}
        onDismiss={handleDismissContextMenu}
      />
    </div>
  )
}

export default memo(AiTabStrip)
