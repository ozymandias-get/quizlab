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
      if (pdfPath.includes('\0') || pdfPath.includes('..'))
        return failure('invalid_input', 'Invalid pdfPath')
      // Must be absolute; renderer cannot pass relative paths to access arbitrary files
      const path = await import('node:path')
      if (!path.isAbsolute(pdfPath)) return failure('invalid_input', 'PDF path must be absolute')
      try {
        const task = await doclingConversionService.convertPdf(pdfPath)
        return success(task)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        // Do not leak stack traces or absolute paths
        const safeMsg = msg.includes('ENOENT') ? 'PDF not found' : msg.slice(0, 500)
        return failure('internal_error', safeMsg)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  const isValidTaskId = (id: string): boolean => /^docling-[a-f0-9]{12}$/.test(id)

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_CONVERT_STATUS,
    async (_event, taskId: string) => {
      if (typeof taskId !== 'string' || !isValidTaskId(taskId))
        return failure('invalid_input', 'Invalid taskId')
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
      if (typeof taskId !== 'string' || !isValidTaskId(taskId))
        return failure('invalid_input', 'Invalid taskId')
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
      if (typeof taskId !== 'string' || !isValidTaskId(taskId))
        return failure('invalid_input', 'Invalid taskId')
      const task = doclingConversionService.getTask(taskId)
      if (!task) return failure('not_found', 'Task not found')
      if (task.status !== 'queued' && task.status !== 'processing') {
        return failure('invalid_input', `Cannot cancel task in ${task.status} state`)
      }
      // Awaits process termination so the caller can immediately start the
      // next conversion without racing the single conversion slot.
      const cancelled = await doclingConversionService.cancelTask(taskId)
      if (!cancelled) return failure('not_found', 'Task not found')
      return success(cancelled)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_CONVERT_REPROCESS,
    async (_event, pdfPath: string) => {
      if (typeof pdfPath !== 'string' || pdfPath.length === 0 || pdfPath.length > 4096) {
        return failure('invalid_input', 'Invalid pdfPath')
      }
      if (pdfPath.includes('\0') || pdfPath.includes('..'))
        return failure('invalid_input', 'Invalid pdfPath')
      const path = await import('node:path')
      if (!path.isAbsolute(pdfPath)) return failure('invalid_input', 'PDF path must be absolute')
      try {
        const task = await doclingConversionService.reconvertPdf(pdfPath)
        return success(task)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return failure('internal_error', msg.slice(0, 500))
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}
