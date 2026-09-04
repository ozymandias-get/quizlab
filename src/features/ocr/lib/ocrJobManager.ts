/**
 * Global OCR job manager — ensures Cancel truly terminates the active WASM job
 * and frees the queue slot, regardless of which component instance calls cancel.
 * Fixes P0-3 hook-local lifecycle issue.
 */
import { Logger } from '@shared/lib/logger'

import { forceTerminateWorker } from '../providers/tesseractProvider'
import { useOcrStore } from '../store/useOcrStore'
import { globalOcrQueue } from './ocrQueue'

type ActiveJob = {
  id: string
  documentId: string
  pageNumber: number
  abortController: AbortController
  queueAbort: (() => void) | null
}

let activeJob: ActiveJob | null = null

export function setActiveJob(job: ActiveJob): void {
  activeJob = job
}

export function clearActiveJobIf(id: string): void {
  if (activeJob?.id === id) activeJob = null
}

export function getActiveJob(): ActiveJob | null {
  return activeJob
}

export async function cancelActiveJob(): Promise<void> {
  if (!activeJob) {
    // Also abort any queued jobs as fallback
    globalOcrQueue.abortAll()
    return
  }
  const job = activeJob
  Logger.info(`[OCR] cancelActiveJob id=${job.id} page=${job.pageNumber}`)
  try {
    job.abortController.abort(new DOMException('Cancelled', 'AbortError'))
  } catch {}
  try {
    job.queueAbort?.()
  } catch {}
  try {
    globalOcrQueue.abortAll()
  } catch {}
  try {
    await forceTerminateWorker()
  } catch (e) {
    Logger.warn('[OCR] forceTerminate on cancel failed', e)
  }
  activeJob = null
  const { requestToken } = useOcrStore.getState()
  useOcrStore.setState({ status: 'cancelled', requestToken: requestToken + 1 })
}
