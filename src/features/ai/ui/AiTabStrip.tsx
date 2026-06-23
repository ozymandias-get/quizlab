import {
  useAiSites,
  useAiTabActions,
  useAiTabsSliceState,
  useAiWebviewHostActions,
  useAiWebviewPresence
} from '@app/providers/AiContext'
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
  const { hasActiveWebview } = useAiWebviewPresence()
  const { setActiveTab, closeTab, renameTab, togglePinTab } = useAiTabActions()
  const { reloadActiveWebview } = useAiWebviewHostActions()
  const { t } = useTranslation()
  const { refs, state, helpers, actions } = useAiTabStripState({
    tabs,
    activeTabId,
    aiSites,
    t,
    renameTab
  })

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
    <div className={TAB_STRIP_BAR_CLASS} data-tour-id="tour-target-ai-tab-strip">
      <div className={TAB_STRIP_ROW_CLASS}>
        <TabStripHomeButton isActive={showHome} tooltip={t('ai_home.home')} onClick={onShowHome} />

        <AiTabStripRefreshButton
          disabled={Boolean(showHome) || tabs.length === 0 || !hasActiveWebview}
          title={t('ai_home.refresh_page')}
          onRefresh={reloadActiveWebview}
        />

        <div className={TAB_STRIP_DIVIDER_CLASS} aria-hidden />

        {state.visibleTabs.map((tab) => (
          <AiVisibleTabButton
            key={tab.id}
            tab={tab}
            label={helpers.getTabLabel(tab)}
            tabColor={helpers.getTabColor(tab)}
            isActive={tab.id === activeTabId}
            isEditing={tab.id === state.editingTabId}
            editingValue={tab.id === state.editingTabId ? state.editingValue : ''}
            renameInputRef={refs.renameInputRef}
            skipBlurSaveRef={refs.skipBlurSaveRef}
            tr={helpers.tr}
            iconKey={aiSites[tab.modelId]?.icon || tab.modelId}
            onSelect={handleSelectTab}
            onBeginRename={actions.beginRename}
            onContextMenu={actions.handleOpenContextMenu}
            onEditingValueChange={actions.setEditingValue}
            onCommitRename={actions.commitRename}
            onCancelRename={actions.cancelRename}
            onTogglePin={togglePinTab}
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
        tr={helpers.tr}
        onBeginRename={actions.beginRename}
        onTogglePin={togglePinTab}
        onCloseTab={closeTab}
        onDismiss={handleDismissContextMenu}
      />
    </div>
  )
}

export default memo(AiTabStrip)
