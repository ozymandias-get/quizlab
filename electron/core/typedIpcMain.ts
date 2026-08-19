import { ipcMain, type IpcMainInvokeEvent } from 'electron'

import { failure } from '../../shared/lib/typedIpc.js'
import type { IpcInvokeChannel, IpcInvokeRequestMap } from '../../shared/types/ipcContract.js'
import { Logger } from './logger.js'

type HandlerFn<C extends IpcInvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: IpcInvokeRequestMap[C]['args']
) => IpcInvokeRequestMap[C]['result'] | Promise<IpcInvokeRequestMap[C]['result']>

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name
  if (typeof err === 'string') return err
  try {
    const serialized = JSON.stringify(err)
    return serialized || 'Unknown error'
  } catch {
    return 'Unknown error'
  }
}

export function registerIpcHandler<C extends IpcInvokeChannel>(
  channel: C,
  handler: HandlerFn<C>,
  trustedCheck?: (event: IpcMainInvokeEvent) => boolean,
  untrustedFallback?: IpcInvokeRequestMap[C]['result']
): void {
  ipcMain.handle(channel, async (event, ...rawArgs: unknown[]) => {
    try {
      if (trustedCheck && !trustedCheck(event)) {
        return untrustedFallback
      }
      return await handler(event, ...(rawArgs as IpcInvokeRequestMap[C]['args']))
    } catch (err: unknown) {
      // Never let a thrown value escape over the IPC bridge. Electron turns a
      // rejected ipcMain.handle into a lossy, non-standard serialized error
      // (or fails to clone it entirely), so the renderer gets an
      // UnhandledPromiseRejection instead of a usable error and its loading
      // UI stays stuck. Return a structured, serializable IpcResult instead;
      // the full original error (incl. stack) is logged here in main.
      Logger.error(`[typedIpcMain] Unhandled error in IPC handler "${channel}"`, err)
      return failure('internal_error', toErrorMessage(err))
    }
  })
}
