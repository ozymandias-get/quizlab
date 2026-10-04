import type { AiContentController } from '@shared-core/types/aiContent'
import type { AiViewSource } from '@shared-core/types/aiView'

import { useToastActions } from '@app/providers'
import { getAiViewClient } from '@shared/hooks/aiContent/aiViewClient'
import { createAiContentController } from '@shared/hooks/aiContent/createAiContentController'
import { useAiContentLifecycle } from '@shared/hooks/aiContent/useAiContentLifecycle'
import { useAiViewHost } from '@shared/hooks/aiContent/useAiViewHost'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/** Stable, collision-free identity for one mounted host placeholder. */
let hostTokenCounter = 0
const createHostToken = (): string => `host-${(hostTokenCounter++).toString(36)}`

export interface UseManagedContentViewOptions {
  viewId: string
  source: AiViewSource
  /** Entry URL replayed on attach; validated in the main process. */
  restoredUrl?: string
  /** Whether a remote view should exist at all. `false` destroys it. */
  isEnabled: boolean
  /**
   * Whether this host is the single writer that may position the native view.
   * Only the active surface / active tab sets this, which keeps a stale host
   * from overwriting the live one.
   */
  isHostOwner: boolean
  /** Whether the native view should currently be on screen. */
  visible: boolean
  /**
   * Keep the view hidden until its first load completes, so a splash can be
   * shown underneath it. Once revealed the view is never hidden again for
   * in-page navigations.
   */
  revealAfterFirstLoad?: boolean
  /** Hide the view while a fatal load error is displayed over it. */
  hideWhenError?: boolean
  /**
   * Whether the guest should forward mouse input to the app instead of handling
   * it. A native view is composited above the DOM, so the bottom bar's hover
   * shield and the divider drag cannot be expressed as a DOM overlay.
   */
  ignoreMouse?: boolean
  modelId: string
  onUrlChange?: (url: string) => void
  onPageSettled?: (controller: AiContentController) => void
  /** Publishes the controller so messaging / selector consumers can address it. */
  registerContent?: (controller: AiContentController | null, expected?: AiContentController) => void
}

export interface UseManagedContentViewResult {
  controller: AiContentController
  isLoading: boolean
  error: string | null
  hasLoadedOnce: boolean
  handleRetry: () => void
  setHostElement: (element: HTMLDivElement | null) => void
  reload: () => void
}

/**
 * Binds one React host placeholder to one main-process `WebContentsView`.
 *
 * Owns the whole handshake — create, position, reveal, release, destroy — so a
 * caller never has to reason about native view lifetime. Two rules make it safe
 * to call from several places at once:
 *
 * - the view is keyed by `viewId`, so a surface swap (focus mode) attaches the
 *   same view again instead of building a second one;
 * - unmounting releases the host claim but does not destroy the view, so an
 *   inactive tab keeps its conversation until it is explicitly torn down.
 */
export function useManagedContentView({
  viewId,
  source,
  restoredUrl,
  isEnabled,
  isHostOwner,
  visible,
  revealAfterFirstLoad = false,
  hideWhenError = false,
  ignoreMouse = false,
  modelId,
  onUrlChange,
  onPageSettled,
  registerContent
}: UseManagedContentViewOptions): UseManagedContentViewResult {
  const { showWarning } = useToastActions()
  const { t } = useTranslation()

  const hostTokenRef = useRef<string | null>(null)
  if (hostTokenRef.current === null) hostTokenRef.current = createHostToken()
  const hostToken = hostTokenRef.current

  const controller = useMemo(
    () => createAiContentController({ viewId, source }),
    // `source` is a stable object literal per call site; the viewId is the
    // identity that matters, a changed model arrives as a new source object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewId, source.kind, 'modelId' in source ? source.modelId : source.appId]
  )

  useEffect(() => {
    return () => controller.dispose()
  }, [controller])

  const onUrlChangeRef = useRef(onUrlChange)
  const onPageSettledRef = useRef(onPageSettled)
  useEffect(() => {
    onUrlChangeRef.current = onUrlChange
    onPageSettledRef.current = onPageSettled
  })

  const handleCrashRecovery = useCallback(() => {
    void controller.recreate(restoredUrl)
  }, [controller, restoredUrl])

  const { isLoading, error, hasLoadedOnce, handleRetry } = useAiContentLifecycle({
    currentAI: modelId,
    controller,
    registerContent,
    t,
    showWarning,
    onUrlChange: (url) => onUrlChangeRef.current?.(url),
    onPageSettled: (content) => onPageSettledRef.current?.(content),
    onCrashRecoveryRequested: handleCrashRecovery
  })

  useEffect(() => {
    if (!isEnabled) {
      void controller.destroy()
      return
    }
    void controller.attach(restoredUrl)
  }, [controller, isEnabled, restoredUrl])

  useEffect(() => {
    if (!isEnabled) return
    return () => {
      void controller.releaseHost(hostToken)
    }
  }, [controller, hostToken, isEnabled])

  const isNativeVisible =
    visible && (!revealAfterFirstLoad || hasLoadedOnce) && (!hideWhenError || error === null)

  const { setHostElement } = useAiViewHost({
    viewId,
    hostToken,
    isHostOwner,
    visible: isNativeVisible
  })

  const client = getAiViewClient()
  const shouldIgnoreMouse = isHostOwner && ignoreMouse
  useEffect(() => {
    if (!client || !isEnabled) return
    client.setIgnoreMouse({ viewId, hostToken, ignore: shouldIgnoreMouse })
  }, [client, hostToken, isEnabled, shouldIgnoreMouse, viewId])

  const reload = useCallback(() => {
    void controller.reload?.()
  }, [controller])

  return {
    controller,
    isLoading,
    error,
    hasLoadedOnce,
    handleRetry,
    setHostElement,
    reload
  }
}
