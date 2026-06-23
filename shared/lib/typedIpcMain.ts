import { ipcMain, type IpcMainInvokeEvent } from 'electron'

import type { IpcInvokeChannel, IpcInvokeRequestMap } from '../types/ipcContract'

type HandlerFn<C extends IpcInvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: IpcInvokeRequestMap[C]['args']
) => IpcInvokeRequestMap[C]['result'] | Promise<IpcInvokeRequestMap[C]['result']>

export function registerIpcHandler<C extends IpcInvokeChannel>(
  channel: C,
  handler: HandlerFn<C>,
  trustedCheck?: (event: IpcMainInvokeEvent) => boolean,
  untrustedFallback?: IpcInvokeRequestMap[C]['result']
): void {
  ipcMain.handle(channel, async (event, ...rawArgs: unknown[]) => {
    if (trustedCheck && !trustedCheck(event)) {
      return untrustedFallback
    }
    return handler(event, ...(rawArgs as IpcInvokeRequestMap[C]['args']))
  })
}
