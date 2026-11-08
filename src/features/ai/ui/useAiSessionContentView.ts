import type { AiContentController } from '@shared-core/types/aiContent'

import { STALE_CONTENT_DETECTION_SCRIPT } from '@features/ai/constants/aiContentLifecycle'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useAiSessionSleep(
  isActive: boolean,
  sleepTimeoutMs: number,
  isNeverSleepSite: (modelId: string) => boolean,
  modelId: string
) {
  const [isSleeping, setIsSleeping] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    if (!isActive) {
      if (!isNeverSleepSite(modelId) && sleepTimeoutMs !== Infinity) {
        timeout = setTimeout(() => {
          setIsSleeping(true)
        }, sleepTimeoutMs)
      }
    } else {
      setIsSleeping(false)
    }
    return () => {
      if (timeout !== undefined) clearTimeout(timeout)
    }
  }, [isActive, sleepTimeoutMs, modelId, isNeverSleepSite])

  const handleWakeUp = useCallback(() => {
    setIsSleeping(false)
  }, [])

  return { isSleeping, setIsSleeping, handleWakeUp }
}

export function useAiSessionStaleCheck(initialUrl: string | undefined, isActive: boolean) {
  const staleCheckHandle = useRef<{ cancel: () => void } | null>(null)
  const staleCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  useEffect(() => {
    return () => {
      staleCheckHandle.current?.cancel()
      if (staleCheckTimerRef.current !== null) {
        clearTimeout(staleCheckTimerRef.current)
        staleCheckTimerRef.current = null
      }
    }
  }, [])

  const handlePageSettled = useCallback(
    (content: AiContentController) => {
      staleCheckHandle.current?.cancel()
      if (staleCheckTimerRef.current !== null) {
        clearTimeout(staleCheckTimerRef.current)
        staleCheckTimerRef.current = null
      }
      if (!initialUrl) return
      if (!isActive) return

      let cancelled = false
      staleCheckHandle.current = {
        cancel: () => {
          cancelled = true
        }
      }

      const runCheck = async () => {
        staleCheckTimerRef.current = null
        if (cancelled || !content || !isActiveRef.current) return

        try {
          const currentUrl = content.getURL?.()
          if (!currentUrl) return

          const c = new URL(currentUrl)
          const b = new URL(initialUrl)
          if (c.origin === b.origin) return

          const isStale = await content.executeJavaScript(STALE_CONTENT_DETECTION_SCRIPT)
          if (cancelled) return

          if (isStale) {
            void content.loadURL?.(initialUrl)
          }
        } catch {
          // Stale check errors are non-fatal
        }
      }

      staleCheckTimerRef.current = setTimeout(runCheck, 500)
    },
    [initialUrl, isActive]
  )

  return { handlePageSettled, staleCheckHandle }
}

/**
 * Freezes the entry URL for the lifetime of a mounted host.
 *
 * The cached URL of a live tab changes on every in-page navigation; re-reading
 * it here would make the attach effect thrash. The URL is therefore captured
 * once and only re-read when the model changes or the tab goes to sleep, which
 * is exactly when the managed view is rebuilt.
 */
export function useAiSessionEntryUrl(
  tabModelId: string,
  isSleeping: boolean,
  restoredUrl: string | undefined,
  initialUrl: string | undefined
) {
  const generation = `${tabModelId}:${isSleeping ? 'sleeping' : 'awake'}`
  const entryUrlRef = useRef<{
    generation: string
    url: string | undefined
  }>({
    generation,
    url: restoredUrl ?? initialUrl
  })

  if (entryUrlRef.current.generation !== generation) {
    entryUrlRef.current = {
      generation,
      url: restoredUrl ?? initialUrl
    }
  }

  const entryUrl = entryUrlRef.current.url

  return { generation, entryUrl }
}
