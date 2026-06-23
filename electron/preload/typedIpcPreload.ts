import { ipcRenderer } from 'electron'

import { failure, type IpcResult } from '../../shared/lib/typedIpc'
import type {
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeChannel,
  IpcInvokeRequestMap
} from '../../shared/types/ipcContract'

const MAX_IPC_ARG_SIZE = 1024 * 512

function safeInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  let totalSize = 0
  for (const arg of args) {
    if (arg === null || arg === undefined) {
      totalSize += 4
    } else if (typeof arg === 'string') {
      totalSize += arg.length * 2
    } else if (typeof arg === 'number' || typeof arg === 'boolean') {
      totalSize += 8
    } else {
      try {
        totalSize += JSON.stringify(arg).length
      } catch {
        return ipcRenderer.invoke(channel, ...args)
      }
    }
    if (totalSize > MAX_IPC_ARG_SIZE) {
      console.warn(
        `[Preload] IPC argument size exceeded (${totalSize} bytes > ${MAX_IPC_ARG_SIZE} bytes) for channel "${channel}". Request rejected.`
      )
      return Promise.resolve(failure('internal_error', 'Payload too large'))
    }
  }
  return ipcRenderer.invoke(channel, ...args)
}

export function typedInvoke<C extends IpcInvokeChannel>(
  channel: C,
  ...args: IpcInvokeRequestMap[C]['args']
): Promise<IpcInvokeRequestMap[C]['result']> {
  return safeInvoke(channel, ...args) as Promise<IpcInvokeRequestMap[C]['result']>
}

export async function unwrapIpcResult<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) {
    const error = new Error(result.error.message)
    ;(error as unknown as Record<string, unknown>).code = result.error.code
    throw error
  }
  return result.data
}

export function onEvent<C extends IpcEventChannel>(
  channel: C,
  callback: (...args: IpcEventMap[C]['args']) => void
): () => void {
  const handleIpcInvoke = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
    callback(...(args as IpcEventMap[C]['args']))
  }
  ipcRenderer.on(channel, handleIpcInvoke)
  return () => ipcRenderer.removeListener(channel, handleIpcInvoke)
}
