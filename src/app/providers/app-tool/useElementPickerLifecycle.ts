import { useCallback, useEffect, useRef, useState } from 'react'
import { useElementPicker } from '@features/automation'

export function useElementPickerLifecycle(webviewInstance: any) {
  const { isPickerActive, startPicker, togglePicker } = useElementPicker(webviewInstance)

  const [pickerStartNonce, setPickerStartNonce] = useState(0)
  const pendingPickerStartRef = useRef(false)

  const startPickerWhenReady = useCallback(() => {
    pendingPickerStartRef.current = true
    setPickerStartNonce((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!pendingPickerStartRef.current || !webviewInstance) {
      return
    }

    let cancelled = false

    const waitForWebviewReady = async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (cancelled || !pendingPickerStartRef.current) {
          return
        }

        try {
          const currentUrl =
            typeof webviewInstance.getURL === 'function' ? webviewInstance.getURL() : ''
          if (!currentUrl || typeof webviewInstance.executeJavaScript !== 'function') {
            await new Promise((resolve) => setTimeout(resolve, 250))
            continue
          }

          const readyState = await webviewInstance.executeJavaScript('document.readyState')
          if (readyState === 'interactive' || readyState === 'complete') {
            pendingPickerStartRef.current = false
            await startPicker()
            return
          }
        } catch {}

        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }

    void waitForWebviewReady()

    return () => {
      cancelled = true
    }
  }, [pickerStartNonce, startPicker, webviewInstance])

  return {
    isPickerActive,
    startPicker,
    startPickerWhenReady,
    togglePicker
  }
}
