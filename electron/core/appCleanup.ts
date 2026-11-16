/**
 * Shared application lifecycle state.
 *
 * `electron/app/index.ts` owns the single `before-quit` path, which confirms
 * pending renderer writes before running this cleanup. `systemHandlers.ts`
 * only requests `app.quit()`; it must never clean up early, because a
 * cancelled quit would otherwise leave a running but torn-down app.
 * This module provides the shared mechanism without circular dependencies.
 */

import { Logger } from './logger.js'

let cleanupFn: (() => Promise<void>) | null = null
let cleanupPromise: Promise<void> | null = null
let cleanupComplete = false

/**
 * Register the cleanup callback.  Called once during app initialization
 * from `index.ts`.  Subsequent calls are ignored.
 */
export function registerCleanup(fn: () => Promise<void>): void {
  if (cleanupFn) return
  cleanupFn = fn
}

/**
 * Run the registered cleanup (if any) and wait for it to complete.
 * Safe to call multiple times — the cleanup runs at most once.
 */
export async function runCleanup(): Promise<void> {
  if (cleanupComplete) return
  if (cleanupPromise) {
    await cleanupPromise
    return
  }
  if (!cleanupFn) return

  cleanupPromise = cleanupFn()
    .catch((error: unknown) => {
      Logger.error('[AppCleanup] Cleanup failed:', error)
    })
    .finally(() => {
      cleanupComplete = true
      cleanupPromise = null
    })

  await cleanupPromise
}
