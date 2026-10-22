/** One account the tab menu can switch the site to. */
interface ContextMenuAccount {
  accountId: string
  /** The name the user sees for the account. */
  name: string
}

export interface ContextMenuState {
  tabId: string
  x: number
  y: number
  /** The accounts of the tab's site; empty when it has nothing to switch to. */
  accounts: ContextMenuAccount[]
}
