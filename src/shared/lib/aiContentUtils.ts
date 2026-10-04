import type { AiContentController, AiContentInputEvent } from '@shared-core/types/aiContent'

import { getElectronApi, hasElectronApi } from './electronApi'
import { Logger } from './logger'

/**
 * Fallback paste for a managed content view.
 *
 * The preferred path is the controller's own `paste()`, which reaches
 * `webContents.paste()` in the main process through the view registry. This
 * helper exists for the case where even that is unavailable, and then simulates
 * Ctrl/Cmd+V, which is what the guest would receive from a real paste anyway.
 */
export const safeContentPaste = async (content: AiContentController | null): Promise<boolean> => {
  if (!content) {
    Logger.error('[ContentPaste] Content controller is undefined')
    return false
  }

  if (typeof content.paste === 'function') {
    try {
      const pasted = await content.paste()
      if (pasted) return true
      Logger.warn('[ContentPaste] content.paste() reported failure, attempting input simulation.')
    } catch (error) {
      Logger.error('[ContentPaste] Native paste failed, falling back to input simulation:', error)
    }
  }

  Logger.warn('[ContentPaste] content.paste() not found or failed, attempting input simulation.')

  try {
    const isMac = hasElectronApi() && getElectronApi()?.platform === 'darwin'
    const modifier = isMac ? 'meta' : 'control'

    if (typeof content.sendInputEvent === 'function') {
      const inputDef: Omit<AiContentInputEvent, 'type'> = {
        keyCode: 'v',
        modifiers: [modifier]
      }

      await content.sendInputEvent({ type: 'keyDown', ...inputDef })
      await content.sendInputEvent({ type: 'char', ...inputDef })
      await content.sendInputEvent({ type: 'keyUp', ...inputDef })
      return true
    }

    Logger.error('[ContentPaste] sendInputEvent API missing')
    return false
  } catch (error) {
    Logger.error('[ContentPaste] Input simulation failed:', error)
    return false
  }
}
