import type { SiteSessionAccountView, SiteSessionSiteView } from '@shared-core/types/siteSession'

/**
 * The translation function the site-session components take.
 *
 * The rows interpolate one or two values (the name of an account, the number
 * of the accounts of a site, the time of the last import), so the signature
 * carries the parameters i18next's `t` accepts.
 */
export type SiteSessionTranslate = (key: string, params?: Record<string, string>) => string

/**
 * What the user can do with the accounts of the sites.
 *
 * Every action names the account it acts on, except the one that resolves a
 * pending session: it also takes a null, which asks for a new account.
 */
export interface SiteSessionActions {
  /** Turns the import of one account on or off. */
  onToggle: (siteId: string, accountId: string) => void
  /** Marks the account the panels of the site open with. */
  onSetActive: (siteId: string, accountId: string) => void
  /** Gives one account the name of the user. */
  onRename: (siteId: string, accountId: string, name: string) => void
  /** Removes one additional account and everything it holds. */
  onDelete: (siteId: string, accountId: string) => void
  /** Writes a pending session into an account, or into a new one for null. */
  onResolvePending: (siteId: string, accountId: string | null) => void
}

export interface SiteSessionAccountRowProps {
  /** The site the account belongs to. */
  siteId: string
  /** The name of the site, for the labels a screen reader reads. */
  siteLabel: string
  /** The account the main process sent. */
  account: SiteSessionAccountView
  /** True while an action is on its way to the main process. */
  disabled: boolean
  actions: SiteSessionActions
  t: SiteSessionTranslate
}

export interface SiteSessionPendingRowProps {
  /** The site whose session waits for the user. */
  siteId: string
  /** The accounts the session can be written into. */
  accounts: SiteSessionAccountView[]
  /** True while an action is on its way to the main process. */
  disabled: boolean
  /** Called with the account the user picked, or null for a new one. */
  onResolve: (siteId: string, accountId: string | null) => void
  t: SiteSessionTranslate
}

export interface SiteSessionCardProps {
  /** The site the main process sent, with the accounts it holds. */
  view: SiteSessionSiteView
  /** True while an action is on its way to the main process. */
  disabled: boolean
  actions: SiteSessionActions
  t: SiteSessionTranslate
}

export interface SiteSessionListProps {
  /** The sites in the order the service returned them. */
  views: SiteSessionSiteView[]
  /** True while an action is on its way to the main process. */
  disabled: boolean
  actions: SiteSessionActions
  t: SiteSessionTranslate
}
