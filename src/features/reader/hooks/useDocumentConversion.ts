import type { QuizLabConversionTask, QuizLabDocument } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { pollTaskUntilTerminal, type TaskPollOutcome } from './conversionPolling'

interface UseDocumentConversionResult {
  document: QuizLabDocument | null
  task: QuizLabConversionTask | null
  isConverting: boolean
  error: string | null
  retry: () => void
  reprocess: () => void
}

export function useDocumentConversion(
  pdfPath: string | null | undefined,
  options?: { enabled?: boolean }
): UseDocumentConversionResult {
  const enabled = options?.enabled ?? true
  const { t } = useTranslation()
  const [document, setDocument] = useState<QuizLabDocument | null>(null)
  const [task, setTask] = useState<QuizLabConversionTask | null>(null)
  const [error, setError] = useState<string | null>(null)
  const taskIdRef = useRef<string | null>(null)
  const prevPdfPathRef = useRef<string | null | undefined>(undefined)
  const taskRef = useRef<QuizLabConversionTask | null>(null)
  const abortPollRef = useRef<{ aborted: boolean }>({ aborted: false })
  useEffect(() => {
    taskRef.current = task
  }, [task])

  const abortPolling = useCallback(() => {
    abortPollRef.current.aborted = true
    abortPollRef.current = { aborted: false }
  }, [])

  /** Cancel the active conversion and wait until main freed the slot. */
  const cancelCurrent = useCallback(async () => {
    const id = taskIdRef.current
    if (!id) return
    taskIdRef.current = null
    const api = getElectronApi()
    // Main awaits process termination before returning – no fixed sleep here.
    await api?.doclingConversion?.cancel(id).catch(() => {})
  }, [])

  const runTask = useCallback(
    async (started: QuizLabConversionTask): Promise<TaskPollOutcome> => {
      if (started.status === 'completed') {
        const api = getElectronApi()
        const doc = await api?.doclingConversion?.getResult(started.taskId).catch(() => null)
        setTask(started)
        setDocument(doc ?? null)
        return 'completed'
      }
      if (started.status === 'failed') {
        setTask(started)
        if ((started.error as { code?: string } | undefined)?.code !== 'cancelled') {
          setError(started.error?.message ?? 'Conversion failed')
        }
        return 'failed'
      }
      abortPolling()
      const signal = abortPollRef.current
      return pollTaskUntilTerminal(
        started.taskId,
        {
          onTick: setTask,
          onCompleted: async (done) => {
            const api = getElectronApi()
            const doc = await api?.doclingConversion?.getResult(done.taskId).catch(() => null)
            setDocument(doc ?? null)
          },
          onError: setError
        },
        signal
      )
    },
    [abortPolling]
  )

  const handleOutcome = useCallback(
    (outcome: TaskPollOutcome) => {
      if (outcome === 'ipc-unavailable') {
        setError(
          t('docling_conversion_status_lost', {
            defaultValue: 'Conversion status lost – the background process is not responding.'
          })
        )
      }
    },
    [t]
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
        const started = await api.doclingConversion.convert(path)
        taskIdRef.current = started.taskId
        handleOutcome(await runTask(started))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setTask((prev) => (prev ? { ...prev, status: 'failed' } : prev))
      }
    },
    [runTask, handleOutcome]
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
      abortPolling()
      setError(null)
      setDocument(null)
      const started = await api.doclingConversion.reprocess(pdfPath)
      taskIdRef.current = started.taskId
      handleOutcome(await runTask(started))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.toLowerCase().includes('cancelled')) return
      setError(msg)
    }
  }, [pdfPath, runTask, startConversion, abortPolling, handleOutcome])

  useEffect(() => {
    const prev = prevPdfPathRef.current
    const changed = prev !== undefined && prev !== pdfPath

    if (changed) {
      prevPdfPathRef.current = pdfPath
      abortPolling()
      // Reset UI state first; cancel+await runs async below.
      setDocument(null)
      setTask(null)
      setError(null)
      if (!enabled || !pdfPath) {
        void cancelCurrent()
        return
      }
      const cancelled = cancelCurrent()
      let stale = false
      void cancelled.then(() => {
        if (!stale) void startConversion(pdfPath)
      })
      return () => {
        stale = true
      }
    }

    prevPdfPathRef.current = pdfPath

    // View mode disabled (switched to PDF) – keep task/document but stop polling, do NOT cancel
    if (!enabled) {
      abortPolling()
      return
    }

    // Same pdfPath but already have a task (e.g. viewMode toggled back) – resume polling, don't restart
    if (taskIdRef.current) {
      const cur = taskRef.current
      if (!cur || cur.status === 'queued' || cur.status === 'processing') {
        const id = taskIdRef.current
        abortPolling()
        const signal = { aborted: false }
        abortPollRef.current = signal
        void pollTaskUntilTerminal(
          id,
          {
            onTick: setTask,
            onCompleted: async (done) => {
              const api = getElectronApi()
              const doc = await api?.doclingConversion?.getResult(done.taskId).catch(() => null)
              setDocument(doc ?? null)
            },
            onError: setError
          },
          signal
        ).then(handleOutcome)
      }
      return
    }

    abortPolling()
    setDocument(null)
    setTask(null)
    setError(null)
    if (!pdfPath || !enabled) return
    void startConversion(pdfPath)
  }, [pdfPath, enabled, startConversion, abortPolling, cancelCurrent, handleOutcome])

  // Cancel on unmount (tab closed while converting)
  useEffect(() => {
    return () => {
      abortPolling()
      void cancelCurrent()
    }
  }, [cancelCurrent, abortPolling])

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
