import type { WebviewElement } from '@shared-core/types/webview'

import { STALE_CONTENT_DETECTION_SCRIPT } from '@features/ai/constants/aiWebviewLifecycle'

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
    (wv: WebviewElement) => {
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
        if (cancelled || !wv || !isActiveRef.current) return

        try {
          const currentUrl = wv.getURL?.()
          if (!currentUrl) return

          const c = new URL(currentUrl)
          const b = new URL(initialUrl)
          if (c.origin === b.origin) return

          const isStale = await wv.executeJavaScript(STALE_CONTENT_DETECTION_SCRIPT)
          if (cancelled) return

          if (isStale) {
            wv.loadURL?.(initialUrl)
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

export function useAiSessionWebviewGeneration(
  tabModelId: string,
  isSleeping: boolean,
  webviewRecoveryKey: number,
  restoredUrl: string | undefined,
  initialUrl: string | undefined
) {
  const generation = `${tabModelId}:${isSleeping ? 'sleeping' : 'awake'}:${webviewRecoveryKey}`
  const webviewSourceRef = useRef<{
    generation: string
    url: string | undefined
  }>({
    generation,
    url: restoredUrl ?? initialUrl
  })

  if (webviewSourceRef.current.generation !== generation) {
    webviewSourceRef.current = {
      generation,
      url: restoredUrl ?? initialUrl
    }
  }

  const webviewSrc = webviewSourceRef.current.url

  return { generation, webviewSrc }
}
