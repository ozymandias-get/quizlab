import {
  useSetSiteSessionActiveAccountMutation,
  useSiteSessionListQuery
} from '@platform/electron/api/useSiteSessionApi'

import { MenuItem, MenuSeparator, MenuSurface } from '@app/components/ui/menu'
import { useMenuKeyboardNavigation } from '@app/components/ui/useMenuKeyboardNavigation'
import type { Tab } from '@app/providers/ai-context'
import { DURATION } from '@shared/lib/motion'

import { motion } from 'motion/react'
import { memo, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import type { ContextMenuState } from './types'

interface AiTabContextMenuProps {
  contextMenu: ContextMenuState | null
  contextMenuTab?: Tab
  tabsCount: number
  contextMenuRef: RefObject<HTMLDivElement | null>
  triggerRef?: RefObject<HTMLElement | null>
  tr: (key: string, fallback: string) => string
  onBeginRename: (tabId: string) => void
  onTogglePin: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onDismiss: () => void
}

function AiTabContextMenu({
  contextMenu,
  contextMenuTab,
  tabsCount,
  contextMenuRef,
  triggerRef,
  tr,
  onBeginRename,
  onTogglePin,
  onCloseTab,
  onDismiss
}: AiTabContextMenuProps) {
  const setContextMenuRef = useMenuKeyboardNavigation(contextMenuRef, {
    onClose: onDismiss,
    triggerRef
  })
  const { data: siteSessionList } = useSiteSessionListQuery()
  const setActiveAccount = useSetSiteSessionActiveAccountMutation()

  if (!contextMenu || !contextMenuTab) {
    return null
  }

  // The account action names the site, while the menu state only carries the
  // tab and its accounts; the site is resolved from the account list itself.
  const siteView = siteSessionList?.accountViews.find((view) =>
    view.memberAppIds.includes(contextMenuTab.modelId)
  )
  const activeAccountId = siteView?.activeAccountId ?? null

  return createPortal(
    <motion.div
      ref={setContextMenuRef}
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: DURATION.normal }}
      className="z-dropdown fixed"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <MenuSurface className="min-w-[160px]">
        <MenuItem onClick={() => onBeginRename(contextMenuTab.id)}>
          {tr('tab_rename', 'Rename')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onTogglePin(contextMenuTab.id)
            onDismiss()
          }}
        >
          {contextMenuTab.pinned ? tr('tab_unpin', 'Unpin') : tr('tab_pin', 'Pin')}
        </MenuItem>
        <MenuItem
          disabled={tabsCount <= 1}
          onClick={() => {
            onCloseTab(contextMenuTab.id)
            onDismiss()
          }}
        >
          {tr('tab_close', 'Close')}
        </MenuItem>

        {contextMenu.accounts.length > 0 && (
          <>
            <MenuSeparator />
            <div
              role="presentation"
              className="text-ql-10 text-muted-foreground px-2.5 py-1 font-semibold"
            >
              {tr('ws_tab_account_change', 'Change account')}
            </div>
            {contextMenu.accounts.map((account) => {
              const isActive = account.accountId === activeAccountId

              return (
                <MenuItem
                  key={account.accountId}
                  aria-current={isActive ? 'true' : undefined}
                  shortcut={isActive ? tr('ws_tab_account_active', 'Active') : undefined}
                  onClick={() => {
                    if (!isActive && siteView) {
                      setActiveAccount.mutate({
                        siteId: siteView.siteId,
                        accountId: account.accountId
                      })
                    }
                    onDismiss()
                  }}
                >
                  {account.name}
                </MenuItem>
              )
            })}
          </>
        )}
      </MenuSurface>
    </motion.div>,
    document.body
  )
}

export default memo(AiTabContextMenu)
