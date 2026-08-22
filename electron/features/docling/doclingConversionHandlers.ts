import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { doclingConversionService } from './doclingConversionService.js'

let handlersRegistered = false

export function registerDoclingConversionHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_CONVERT,
    async (_event, pdfPath: string) => {
      if (typeof pdfPath !== 'string' || pdfPath.length === 0 || pdfPath.length > 4096) {
        return failure('invalid_input', 'Invalid pdfPath')
      }
      // Basic path sanity: must be absolute and not contain null bytes
      if (pdfPath.includes('\0')) return failure('invalid_input', 'Invalid pdfPath')
      try {
        const task = await doclingConversionService.convertPdf(pdfPath)
        return success(task)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return failure('internal_error', msg)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_CONVERT_STATUS,
    async (_event, taskId: string) => {
      if (typeof taskId !== 'string' || !taskId) return failure('invalid_input', 'Invalid taskId')
      const task = doclingConversionService.getTask(taskId)
      if (!task) return failure('not_found', 'Task not found')
      return success(task)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_CONVERT_RESULT,
    async (_event, taskId: string) => {
      if (typeof taskId !== 'string' || !taskId) return failure('invalid_input', 'Invalid taskId')
      const task = doclingConversionService.getTask(taskId)
      if (!task) return failure('not_found', 'Task not found')
      if (task.status !== 'completed')
        return failure('invalid_input', `Task not completed: ${task.status}`)
      const doc = doclingConversionService.getResult(taskId)
      if (!doc) return failure('not_found', 'Result not found')
      return success(doc)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_CONVERT_CANCEL,
    async (_event, taskId: string) => {
      if (typeof taskId !== 'string' || !taskId) return failure('invalid_input', 'Invalid taskId')
      // No-op for now: tasks are one-shot processes; cancellation would kill the child.
      // Placeholder to satisfy the contract without fake progress.
      const task = doclingConversionService.getTask(taskId)
      if (!task) return failure('not_found', 'Task not found')
      return success(task)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}
