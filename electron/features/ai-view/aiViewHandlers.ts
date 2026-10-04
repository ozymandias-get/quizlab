import { ipcMain } from 'electron'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import type { AiViewAttachRequest, AiViewEvent } from '../../../shared/types/aiView.js'
import { APP_CONFIG } from '../../app/constants.js'
import { getMainWindow } from '../../app/windowManager.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { Logger } from '../../core/logger.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import {
  parseDelta,
  parseHostRequest,
  parseHostSyncRequest,
  parseInputEvent,
  parseRestoredUrl,
  parseScript,
  parseSource,
  parseTabRequest,
  parseText
} from './aiViewContract.js'
import {
  attachAiView,
  destroyAiView,
  destroyAllAiViews,
  detachAiViewHost,
  executeAiViewScript,
  focusAiView,
  getAiViewUrl,
  insertAiViewText,
  loadAiViewUrl,
  navigateAiView,
  pasteAiView,
  reloadAiView,
  sendAiViewInputEvent,
  setAiViewEventSink,
  syncAiViewHost
} from './aiWebContentsViewManager.js'

const { IPC_CHANNELS } = APP_CONFIG

const DENIED = success(false)

let handlersRegistered = false

function sendEvent(event: AiViewEvent): void {
  const window = getMainWindow()
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return
  window.webContents.send(IPC_CHANNELS.AI_VIEW_EVENT, event)
}

export function registerAiViewHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true
  setAiViewEventSink(sendEvent)

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_ATTACH,
    async (_event, request: AiViewAttachRequest) => {
      const viewId = parseTabRequest(request)?.viewId
      const source = parseSource(request?.source)
      const restoredUrl = parseRestoredUrl(request?.restoredUrl)
      if (!viewId || !source) return failure('invalid_input', 'Invalid attach request')

      try {
        return success(
          await attachAiView({ viewId, source, ...(restoredUrl ? { restoredUrl } : {}) })
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        Logger.warn('[AiView] attach rejected:', message)
        return failure('not_found', message)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_DETACH,
    (_event, request: unknown) => {
      const parsed = parseHostRequest(request)
      if (!parsed) return success(false)
      return success(detachAiViewHost(parsed.viewId, parsed.hostToken))
    },
    requireTrustedIpcSender,
    DENIED
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_DESTROY,
    async (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      if (!parsed) return success(false)
      // Queued behind a pending attach for the same id, so it cannot race past a
      // view that does not exist yet and orphan its WebContents.
      return success(await destroyAiView(parsed.viewId))
    },
    requireTrustedIpcSender,
    DENIED
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_RELOAD,
    (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      if (!parsed) return success(false)
      return success(reloadAiView(parsed.viewId))
    },
    requireTrustedIpcSender,
    DENIED
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_LOAD_URL,
    (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      if (!parsed) return success(false)
      const rawUrl = (request as { url?: unknown } | null)?.url
      return success(loadAiViewUrl(parsed.viewId, parseRestoredUrl(rawUrl)))
    },
    requireTrustedIpcSender,
    DENIED
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_NAVIGATE,
    (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      const delta = parseDelta((request as { delta?: unknown } | null)?.delta)
      if (!parsed || delta === null) return success(false)
      return success(navigateAiView(parsed.viewId, delta))
    },
    requireTrustedIpcSender,
    DENIED
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_GET_URL,
    (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      if (!parsed) return success(null)
      return success(getAiViewUrl(parsed.viewId))
    },
    requireTrustedIpcSender,
    success(null)
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_EXECUTE_SCRIPT,
    async (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      const script = parseScript((request as { script?: unknown } | null)?.script)
      if (!parsed || script === null) return failure('invalid_input', 'Invalid script request')
      try {
        return success(await executeAiViewScript(parsed.viewId, script))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return failure('internal_error', message)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_INSERT_TEXT,
    (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      const text = parseText((request as { text?: unknown } | null)?.text)
      if (!parsed || text === null) return success(false)
      return success(insertAiViewText(parsed.viewId, text))
    },
    requireTrustedIpcSender,
    DENIED
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_SEND_INPUT_EVENT,
    (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      const inputEvent = parseInputEvent((request as { inputEvent?: unknown } | null)?.inputEvent)
      if (!parsed || !inputEvent) return success(false)
      return success(sendAiViewInputEvent(parsed.viewId, inputEvent))
    },
    requireTrustedIpcSender,
    DENIED
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_PASTE,
    (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      if (!parsed) return success(false)
      return success(pasteAiView(parsed.viewId))
    },
    requireTrustedIpcSender,
    DENIED
  )

  registerIpcHandler(
    IPC_CHANNELS.AI_VIEW_FOCUS,
    (_event, request: unknown) => {
      const parsed = parseTabRequest(request)
      if (!parsed) return success(false)
      return success(focusAiView(parsed.viewId))
    },
    requireTrustedIpcSender,
    DENIED
  )

  ipcMain.on(IPC_CHANNELS.AI_VIEW_SYNC_HOST, (event, request: unknown) => {
    if (!requireTrustedIpcSender(event)) return
    const parsed = parseHostSyncRequest(request)
    if (!parsed) return
    syncAiViewHost(parsed.viewId, parsed.hostToken, parsed.bounds, parsed.visible)
  })
}

/** Called from the app cleanup chain so no managed WebContents outlives the window. */
export async function disposeAiViewHandlers(): Promise<void> {
  setAiViewEventSink(null)
  await destroyAllAiViews()
}
