import { useAppearance } from '@app/providers'
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

import { memo, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { createPinnedAiProject, savePinnedAiProject } from '../lib/pinnedProjects'
import { useChatUiStore } from '../store/chatUiStore'
import AiOverflowMenu from './aiTabStrip/AiOverflowMenu'
import AiTabContextMenu from './aiTabStrip/AiTabContextMenu'
import AiTabStripPinButton from './aiTabStrip/AiTabStripPinButton'
import AiTabStripRefreshButton from './aiTabStrip/AiTabStripRefreshButton'
import AiVisibleTabButton from './aiTabStrip/AiVisibleTabButton'
import PinAiProjectDialog from './aiTabStrip/PinAiProjectDialog'
import { useAiTabStripState } from './aiTabStrip/useAiTabStripState'

interface AiTabStripProps {
  showHome?: boolean
  onShowHome?: () => void
  onHideHome?: () => void
  /** Last known URL per tab; used by the pin dialog when the view is not live. */
  getTabUrl: (tabId: string, modelId: string) => string | undefined
  /** Tabs whose native session has been put to sleep. */
  sleepingTabIds?: ReadonlySet<string>
}

function AiTabStrip({
  showHome,
  onShowHome,
  onHideHome,
  getTabUrl,
  sleepingTabIds
}: AiTabStripProps) {
  const { tabs, activeTabId } = useAiTabsSliceState()
  const isLayoutSwapped = useAppearance((s) => s.isLayoutSwapped)
  const isStreamingByTab = useChatUiStore((s) => s.isStreamingByTab)
  const aiSites = useAiSites()
  const { hasActiveContent } = useAiContentPresence()
  const { setActiveTab, closeTab, moveTab } = useAiTabActions()
  const { reloadActiveContent } = useAiContentHostActions()
  const { t } = useTranslation()
  const [isPinOpen, setIsPinOpen] = useState(false)
  const [pinTabId, setPinTabId] = useState('')
  const { refs, state, helpers, actions } = useAiTabStripState({
    tabs,
    activeTabId,
    aiSites,
    t,
    hasPin: true
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

  const handleOpenPin = useCallback(() => {
    setPinTabId(activeTabId || tabs[0]?.id || '')
    setIsPinOpen(true)
  }, [activeTabId, tabs])

  const handleSavePin = useCallback((input: { modelId: string; name: string; url: string }) => {
    const project = createPinnedAiProject(input.modelId, input.name, input.url)
    if (project) savePinnedAiProject(project)
  }, [])

  return (
    <div
      className={`${TAB_STRIP_BAR_CLASS}${isLayoutSwapped ? '' : 'window-controls-safe'}`}
      data-window-edge={isLayoutSwapped ? 'left' : undefined}
    >
      <div ref={refs.rowRef} className={TAB_STRIP_ROW_CLASS} {...rowDragHandlers}>
        <TabStripHomeButton isActive={showHome} tooltip={t('ai_home.home')} onClick={onShowHome} />

        <AiTabStripRefreshButton
          disabled={Boolean(showHome) || tabs.length === 0 || !hasActiveContent}
          title={t('ai_home.refresh_page')}
          onRefresh={reloadActiveContent}
        />

        <AiTabStripPinButton
          disabled={tabs.length === 0 || tabs.every((tab) => tab.modelId === 'api-chat')}
          title={t('ai_home.pin_project')}
          onPin={handleOpenPin}
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
            isStreaming={isStreamingByTab[tab.id] ?? false}
            isSleeping={sleepingTabIds?.has(tab.id) ?? false}
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

      {typeof document !== 'undefined' &&
        createPortal(
          <PinAiProjectDialog
            isOpen={isPinOpen}
            onClose={() => setIsPinOpen(false)}
            tabs={tabs}
            initialTabId={pinTabId}
            aiSites={aiSites}
            getTabUrl={getTabUrl}
            onSave={handleSavePin}
          />,
          document.body
        )}
    </div>
  )
}

export default memo(AiTabStrip)
