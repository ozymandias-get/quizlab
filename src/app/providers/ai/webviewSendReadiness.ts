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

  while (Date.now() - startedAt < timeoutMs) {
    if (await isWebviewReadyForSend(getController())) return true

    const elapsed = Date.now() - startedAt
    const remaining = timeoutMs - elapsed
    if (remaining <= 0) break

    await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, remaining)))
  }

  return isWebviewReadyForSend(getController())
}
