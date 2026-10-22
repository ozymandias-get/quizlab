/**
 * The runtime seam for account partitions created after start-up.
 *
 * An account a packet or the pending-session dialog opens did not exist when
 * the app registered its partitions, so its partition has to be registered at
 * the moment it is created: the permission policy has to trust its origin, the
 * cache registry has to know it, and its session has to get the app's handlers.
 *
 * That work lives in the window layer, which owns sessions and permissions,
 * while the code that opens an account lives in this feature. The registrar is
 * therefore injected from the composition root: this module holds the current
 * callback, and the account code calls it without importing the window layer —
 * which would close the cycle the startup registration was split to avoid.
 */

import type { SiteSessionTargetRow } from './siteSessionTargets.js'

/** Registers a partition minted for one account of a site. */
export type SiteSessionAccountRegistrar = (site: SiteSessionTargetRow, accountId: string) => void

let registrar: SiteSessionAccountRegistrar | null = null

/** Sets the registrar the account code calls; the window layer owns it. */
export function setSiteSessionAccountRegistrar(next: SiteSessionAccountRegistrar): void {
  registrar = next
}

/**
 * Registers the partition of a freshly created account.
 *
 * Before the composition root has wired the registrar this does nothing: a
 * service built on its own (a test, a tool) must not reach for Electron
 * sessions, and the account it opens is still usable inside the service.
 */
export function registerRuntimeAccount(site: SiteSessionTargetRow, accountId: string): void {
  registrar?.(site, accountId)
}
