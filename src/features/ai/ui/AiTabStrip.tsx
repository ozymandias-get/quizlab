import { memo } from 'react'
import { useLanguageStrings } from '@app/providers'
import {
  useAiModelsCatalog,
  useAiCoreWorkspaceActions,
  useAiTabsSliceState,
  useAiWebviewHostActions,
  useAiWebviewPresence
} from '@app/providers/AiContext'
import {
  TAB_STRIP_BAR_CLASS,
  TAB_STRIP_DIVIDER_CLASS,
  TAB_STRIP_ROW_CLASS
} from '@shared/ui/tabStripChrome'
import AiOverflowMenu from './aiTabStrip/AiOverflowMenu'
import AiTabContextMenu from './aiTabStrip/AiTabContextMenu'
import AiTabStripHomeButton from './aiTabStrip/AiTabStripHomeButton'
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
  const { aiSites } = useAiModelsCatalog()
  const { hasActiveWebview } = useAiWebviewPresence()
  const { setActiveTab, closeTab, renameTab, togglePinTab } = useAiCoreWorkspaceActions()
  const { reloadActiveWebview } = useAiWebviewHostActions()
  const { t } = useLanguageStrings()
  const { refs, state, helpers, actions } = useAiTabStripState({
    tabs,
    activeTabId,
    aiSites,
    t,
    renameTab
  })

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId)
    onHideHome?.()
  }

  return (
    <div className={TAB_STRIP_BAR_CLASS}>
      <div className={TAB_STRIP_ROW_CLASS}>
        <AiTabStripHomeButton
          showHome={showHome}
          title={t('ai_home.home')}
          onShowHome={onShowHome}
        />

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
            editingValue={state.editingValue}
            renameInputRef={refs.renameInputRef}
            skipBlurSaveRef={refs.skipBlurSaveRef}
            tr={helpers.tr}
            iconKey={aiSites[tab.modelId]?.icon || tab.modelId}
            onSelect={() => handleSelectTab(tab.id)}
            onBeginRename={() => actions.beginRename(tab)}
            onContextMenu={(event) => actions.handleOpenContextMenu(event, tab.id)}
            onEditingValueChange={actions.setEditingValue}
            onCommitRename={(value) => actions.commitRename(tab.id, value)}
            onCancelRename={actions.cancelRename}
            onTogglePin={() => togglePinTab(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}

        <AiOverflowMenu
          overflowTabs={state.overflowTabs}
          overflowRef={refs.overflowRef}
          isOverflowOpen={state.isOverflowOpen}
          tr={helpers.tr}
          getTabLabel={helpers.getTabLabel}
          getIconKey={(tab) => aiSites[tab.modelId]?.icon || tab.modelId}
          onToggleOpen={() => actions.setIsOverflowOpen((prev) => !prev)}
          onSelectTab={(tabId) => {
            handleSelectTab(tabId)
            actions.setIsOverflowOpen(false)
          }}
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
        onDismiss={() => actions.setContextMenu(null)}
      />
    </div>
  )
}

export default memo(AiTabStrip)
