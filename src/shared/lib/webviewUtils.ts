import { Logger } from './logger'
import type { WebviewController, WebviewInputEvent } from '@shared-core/types/webview'
import { getElectronApi, hasElectronApi } from './electronApi'

/** Tries `webview.paste()`, then Ctrl/Cmd+V via `sendInputEvent`. */
export const safeWebviewPaste = (webview: WebviewController | null): boolean => {
  if (!webview) {
    Logger.error('[WebviewUtils] Webview is undefined')
    return false
  }

  if (typeof webview.paste === 'function') {
    try {
      webview.paste()
      return true
    } catch (error) {
      Logger.error('[WebviewUtils] Native paste failed:', error)
      return false
    }
  }

  Logger.warn('[WebviewUtils] webview.paste() not found, attempting input simulation.')

  try {
    const modifier = hasElectronApi() && getElectronApi().platform === 'darwin' ? 'meta' : 'control'

    if (typeof webview.sendInputEvent === 'function') {
      const inputDef: Omit<WebviewInputEvent, 'type'> = {
        keyCode: 'v',
        modifiers: [modifier]
      }

      webview.sendInputEvent({ type: 'keyDown', ...inputDef })
      webview.sendInputEvent({ type: 'char', ...inputDef })
      webview.sendInputEvent({ type: 'keyUp', ...inputDef })
      return true
    }

    Logger.error('[WebviewUtils] sendInputEvent API missing')
    return false
  } catch (error) {
    Logger.error('[WebviewUtils] Input simulation failed:', error)
    return false
  }
}
