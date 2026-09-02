import { ipcRenderer } from 'electron'

import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js'
import { failure, type IpcResult } from '../../shared/lib/typedIpc.js'
import type {
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeChannel,
  IpcInvokeRequestMap
} from '../../shared/types/ipcContract.js'

const MAX_IPC_ARG_SIZE = 1024 * 512
const MAX_IMAGE_IPC_ARG_SIZE = 50 * 1024 * 1024 // 50 MB for image data

function safeInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const maxLimit = channel === IPC_CHANNELS.COPY_IMAGE ? MAX_IMAGE_IPC_ARG_SIZE : MAX_IPC_ARG_SIZE

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
    if (totalSize > maxLimit) {
      console.warn(
        `[Preload] IPC argument size exceeded (${totalSize} bytes > ${maxLimit} bytes) for channel "${channel}". Request rejected.`
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
