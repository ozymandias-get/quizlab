import type { QuizLabConversionTask, QuizLabDocument } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseDocumentConversionResult {
  document: QuizLabDocument | null
  task: QuizLabConversionTask | null
  isConverting: boolean
  error: string | null
  retry: () => void
  reprocess: () => void
}

const POLL_INTERVAL_MS = 900

export function useDocumentConversion(
  pdfPath: string | null | undefined,
  options?: { enabled?: boolean }
): UseDocumentConversionResult {
  const enabled = options?.enabled ?? true
  const [document, setDocument] = useState<QuizLabDocument | null>(null)
  const [task, setTask] = useState<QuizLabConversionTask | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const taskIdRef = useRef<string | null>(null)
  const prevPdfPathRef = useRef<string | null | undefined>(undefined)
  const taskRef = useRef<QuizLabConversionTask | null>(null)
  useEffect(() => {
    taskRef.current = task
  }, [task])

  const clearPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const cancelCurrent = useCallback(() => {
    const id = taskIdRef.current
    if (!id) return
    const api = getElectronApi()
    // Only cancel if task was still converting; main will no-op for completed
    api?.doclingConversion?.cancel(id).catch(() => {})
  }, [])

  const startPolling = useCallback(
    (taskId: string) => {
      const api = getElectronApi()
      if (!api?.doclingConversion) return
      if (pollRef.current !== null) return
      pollRef.current = window.setInterval(async () => {
        try {
          const cur = await api.doclingConversion.getStatus(taskId)
          setTask(cur)
          if (cur.status === 'completed') {
            clearPoll()
            const doc = await api.doclingConversion.getResult(cur.taskId)
            setDocument(doc)
          } else if (cur.status === 'failed') {
            clearPoll()
            if ((cur.error as { code?: string } | undefined)?.code === 'cancelled') return
            setError(cur.error?.message ?? 'Conversion failed')
          }
        } catch {
          // keep polling
        }
      }, POLL_INTERVAL_MS)
    },
    [clearPoll]
  )

  const startConversion = useCallback(
    async (path: string) => {
      const api = getElectronApi()
      if (!api?.doclingConversion) {
        setError('Conversion not available in this environment')
        return
      }
      try {
        setError(null)
        setDocument(null)
        const t = await api.doclingConversion.convert(path)
        taskIdRef.current = t.taskId
        setTask(t)
        if (t.status === 'completed') {
          const doc = await api.doclingConversion.getResult(t.taskId)
          setDocument(doc)
          return
        }
        if (t.status === 'failed') {
          if ((t.error as { code?: string } | undefined)?.code === 'cancelled') {
            clearPoll()
            setTask(t)
            return
          }
          setError(t.error?.message ?? 'Conversion failed')
          return
        }
        // Poll for async task
        pollRef.current = window.setInterval(async () => {
          if (!taskIdRef.current) return
          try {
            const cur = await api.doclingConversion.getStatus(taskIdRef.current)
            setTask(cur)
            if (cur.status === 'completed') {
              clearPoll()
              const doc = await api.doclingConversion.getResult(cur.taskId)
              setDocument(doc)
            } else if (cur.status === 'failed') {
              clearPoll()
              if ((cur.error as { code?: string } | undefined)?.code === 'cancelled') {
                // User closed PDF – don't show error
                return
              }
              setError(cur.error?.message ?? 'Conversion failed')
            }
          } catch {
            // keep polling
          }
        }, POLL_INTERVAL_MS)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setTask((prev) => (prev ? { ...prev, status: 'failed' } : prev))
      }
    },
    [clearPoll]
  )

  const retry = useCallback(() => {
    if (pdfPath && enabled) void startConversion(pdfPath)
  }, [pdfPath, enabled, startConversion])

  const reprocess = useCallback(async () => {
    if (!pdfPath) return
    const api = getElectronApi()
    if (!api?.doclingConversion?.reprocess) {
      void startConversion(pdfPath)
      return
    }
    try {
      clearPoll()
      setError(null)
      setDocument(null)
      const t = await api.doclingConversion.reprocess(pdfPath)
      taskIdRef.current = t.taskId
      setTask(t)
      if (t.status === 'completed') {
        const doc = await api.doclingConversion.getResult(t.taskId)
        setDocument(doc)
        return
      }
      if (t.status === 'failed') {
        if ((t.error as { code?: string } | undefined)?.code === 'cancelled') return
        setError(t.error?.message ?? 'Conversion failed')
        return
      }
      pollRef.current = window.setInterval(async () => {
        if (!taskIdRef.current) return
        try {
          const cur = await api.doclingConversion.getStatus(taskIdRef.current)
          setTask(cur)
          if (cur.status === 'completed') {
            clearPoll()
            const doc = await api.doclingConversion.getResult(cur.taskId)
            setDocument(doc)
          } else if (cur.status === 'failed') {
            clearPoll()
            if ((cur.error as { code?: string } | undefined)?.code === 'cancelled') return
            setError(cur.error?.message ?? 'Conversion failed')
          }
        } catch {
          // keep polling
        }
      }, POLL_INTERVAL_MS)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.toLowerCase().includes('cancelled')) return
      setError(msg)
    }
  }, [pdfPath, clearPoll, startConversion])

  useEffect(() => {
    const prev = prevPdfPathRef.current
    const changed = prev !== undefined && prev !== pdfPath

    if (changed) {
      if (prev) cancelCurrent()
      prevPdfPathRef.current = pdfPath
      clearPoll()
      // New PDF (or closed) – reset UI state
      setDocument(null)
      setTask(null)
      setError(null)
      taskIdRef.current = null
      if (!enabled || !pdfPath) return
      // If we just cancelled a previous conversion, give main a moment to free the slot
      const delay = prev ? 550 : 0
      if (delay > 0) {
        const t = window.setTimeout(() => void startConversion(pdfPath), delay)
        return () => {
          window.clearTimeout(t)
          clearPoll()
        }
      }
      void startConversion(pdfPath)
      return () => clearPoll()
    }

    prevPdfPathRef.current = pdfPath

    // View mode disabled (switched to PDF) – keep task/document but stop polling, do NOT cancel
    if (!enabled) {
      clearPoll()
      return
    }

    // Same pdfPath but already have a task (e.g. viewMode toggled back) – resume polling, don't restart
    if (taskIdRef.current) {
      const cur = taskRef.current
      if (!cur || cur.status === 'queued' || cur.status === 'processing') {
        if (pollRef.current === null) startPolling(taskIdRef.current)
      }
      return
    }

    clearPoll()
    setDocument(null)
    setTask(null)
    setError(null)
    taskIdRef.current = null
    if (!pdfPath || !enabled) return
    void startConversion(pdfPath)
    return () => clearPoll()
  }, [pdfPath, enabled, startConversion, clearPoll, cancelCurrent, startPolling])

  // Cancel on unmount (tab closed while converting)
  useEffect(() => {
    return () => {
      cancelCurrent()
      clearPoll()
    }
  }, [cancelCurrent, clearPoll])

  // Subscribe to progress events (real Docling status if available)
  useEffect(() => {
    const api = getElectronApi()
    if (!api?.doclingConversion?.onProgress) return
    const off = api.doclingConversion.onProgress((t) => {
      if (t.pdfPath !== pdfPath) return
      setTask(t)
      if (
        t.status === 'failed' &&
        (t.error as { code?: string } | undefined)?.code !== 'cancelled'
      ) {
        setError(t.error?.message ?? 'Conversion failed')
      }
    })
    return off
  }, [pdfPath])

  const isConverting = task?.status === 'queued' || task?.status === 'processing'

  return { document, task, isConverting, error, retry, reprocess }
}
