import type { WebviewController } from '@shared-core/types/webview'

const READY_STATES = new Set(['interactive', 'complete'])

/**
 * A registered controller is not necessarily ready to receive automation.
 * Electron attaches the controller before the guest page has a URL or DOM.
 */
export async function isWebviewReadyForSend(
  controller: WebviewController | null
): Promise<boolean> {
  if (!controller) return false

  try {
    if (controller.isDestroyed?.() === true) return false
    if (!controller.getURL?.()) return false
    if (typeof controller.executeJavaScript !== 'function') return false

    const readyState = await controller.executeJavaScript('document.readyState')
    return typeof readyState === 'string' && READY_STATES.has(readyState)
  } catch {
    // Navigation can temporarily reject executeJavaScript while the old guest
    // document is being replaced. The polling caller will try again.
    return false
  }
}

export async function waitForWebviewReadyForSend(
  getController: () => WebviewController | null,
  timeoutMs = 10_000,
  pollIntervalMs = 100
): Promise<boolean> {
  const startedAt = Date.now()

  // Fast-path: check cheap synchronous guards before any IPC. This avoids
  // calling executeJavaScript when the guest has no URL or is destroyed,
  // which would otherwise trigger a needless round-trip.
  const isControllerCheapReady = (controller: WebviewController | null) => {
    if (!controller) return false
    if (controller.isDestroyed?.() === true) return false
    if (!controller.getURL?.()) return false
    // If the guest is still loading, document.readyState is likely 'loading' — skip IPC.
    const isLoading = (controller as unknown as { isLoading?: () => boolean }).isLoading
    if (typeof isLoading === 'function' && isLoading()) return false
    return true
  }

  let attempt = 0
  while (Date.now() - startedAt < timeoutMs) {
    const controller = getController()
    if (isControllerCheapReady(controller) && (await isWebviewReadyForSend(controller))) return true

    const elapsed = Date.now() - startedAt
    const remaining = timeoutMs - elapsed
    if (remaining <= 0) break

    // Exponential backoff: start at min(pollIntervalMs, 50) and grow to pollIntervalMs
    // so the first few checks are eager (fast connect) but we don't spam IPC
    // for 10s straight. ~12 attempts total vs. 100 previously.
    const backoff = Math.min(pollIntervalMs, 50 * Math.pow(1.5, attempt))
    attempt += 1
    await new Promise((resolve) => setTimeout(resolve, Math.min(backoff, remaining)))
  }

  return isWebviewReadyForSend(getController())
}
