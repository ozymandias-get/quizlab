/**
 * Shared application lifecycle state.
 *
 * Both `electron/app/index.ts` (the main entry point) and
 * `electron/core/systemHandlers.ts` (the APP_QUIT handler) need
 * coordinated cleanup before quitting.  This module provides a
 * shared mechanism without creating circular dependencies.
 */

import { Logger } from './logger'

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
