import type { QuizLabConversionTask, QuizLabDocument } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseDocumentConversionResult {
  document: QuizLabDocument | null
  task: QuizLabConversionTask | null
  isConverting: boolean
  error: string | null
  retry: () => void
}

const POLL_INTERVAL_MS = 900

export function useDocumentConversion(
  pdfPath: string | null | undefined
): UseDocumentConversionResult {
  const [document, setDocument] = useState<QuizLabDocument | null>(null)
  const [task, setTask] = useState<QuizLabConversionTask | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const taskIdRef = useRef<string | null>(null)

  const clearPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

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
    if (pdfPath) void startConversion(pdfPath)
  }, [pdfPath, startConversion])

  useEffect(() => {
    clearPoll()
    setDocument(null)
    setTask(null)
    setError(null)
    taskIdRef.current = null
    if (!pdfPath) return
    void startConversion(pdfPath)
    return () => clearPoll()
  }, [pdfPath, startConversion, clearPoll])

  // Subscribe to progress events (real Docling status if available)
  useEffect(() => {
    const api = getElectronApi()
    if (!api?.doclingConversion?.onProgress) return
    const off = api.doclingConversion.onProgress((t) => {
      if (t.pdfPath !== pdfPath) return
      setTask(t)
      if (t.status === 'failed') setError(t.error?.message ?? 'Conversion failed')
    })
    return off
  }, [pdfPath])

  const isConverting = task?.status === 'queued' || task?.status === 'processing'

  return { document, task, isConverting, error, retry }
}
