import type { AiContentController, AiContentRef } from '@shared-core/types/aiContent'

import { useElementPicker } from '@features/automation'

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { PickerReadinessReason } from './aiContentPickerReadiness'

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/** How long an armed picker waits for the target tab to produce content. */
const PICKER_ARM_TIMEOUT_MS = 15_000

/**
 * Hook to manage the automatic arming and injection of the element picker into a managed view.
 * aiContentPickerReadiness is dynamically imported on first use to keep it out of the main chunk.
 */
export function useElementPickerLifecycle(
  getContentController: () => AiContentRef | null | undefined,
  activeTabId?: string,
  hasActiveContent = true
) {
  const { showError } = useToastActions()

  const {
    startPicker: pickerStartPicker,
    stopPicker: pickerStopPicker,
    isPickerActive,
    togglePicker
  } = useElementPicker(getContentController)

  const [armVersion, setArmVersion] = useState(0)
  const pendingPickerStartRef = useRef(false)
  /**
   * Tab the armed start belongs to. The settings re-pick flow opens a tab and
   * arms in the same tick, so `activeTabId` can still name the previous tab;
   * the caller passes the id `openAiWorkspace` returned. When absent (dock
   * button) the tab active at arm time is used. A null target means "no tab
   * yet", and the old wait-for-any-content behaviour applies.
   */
  const pendingTargetTabIdRef = useRef<string | null>(null)
  const requestSeqRef = useRef(0)
  const armTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pickerModRef = useRef<{
    oncePickerReady: (
      controller: AiContentController,
      signal: AbortSignal
    ) => Promise<PickerReadinessReason>
    waitForContentReady: (controller: AiContentController, signal: AbortSignal) => Promise<void>
  } | null>(null)
  const lifecycleAbortRef = useRef<AbortController | null>(null)

  const loadReadinessModule = useCallback(async () => {
    if (pickerModRef.current) return pickerModRef.current
    const readinessMod = await import('./aiContentPickerReadiness')
    pickerModRef.current = {
      oncePickerReady: readinessMod.oncePickerReady,
      waitForContentReady: readinessMod.waitForContentReady
    }
    return pickerModRef.current
  }, [])

  const clearArmTimeout = useCallback(() => {
    if (armTimeoutRef.current === null) return
    clearTimeout(armTimeoutRef.current)
    armTimeoutRef.current = null
  }, [])

  /**
   * Single, idempotent teardown for an armed start. The timer callback, a tab
   * switch and unmount all race each other, so they must all reset the same
   * four things: the pending flag, the target tab, the arm timer and the
   * readiness subscriptions.
   */
  const cancelPendingStart = useCallback(() => {
    pendingPickerStartRef.current = false
    pendingTargetTabIdRef.current = null
    clearArmTimeout()
    lifecycleAbortRef.current?.abort()
    lifecycleAbortRef.current = null
  }, [clearArmTimeout])

  const clearPendingRequest = useCallback(
    (requestId: number) => {
      if (requestSeqRef.current === requestId) {
        pendingPickerStartRef.current = false
        pendingTargetTabIdRef.current = null
        clearArmTimeout()
      }
    },
    [clearArmTimeout]
  )

  const isCurrentPendingRequest = useCallback((requestId: number) => {
    return requestSeqRef.current === requestId && pendingPickerStartRef.current
  }, [])

  /**
   * Arms the picker without requiring a controller at call time.
   *
   * The settings "re-pick" flow opens a tab and arms in the same tick, before
   * the new tab has a controller. The old early return then dropped the request
   * silently. The effect below waits for the target tab (its `activeTabId` and
   * `hasActiveContent`) and starts once content exists; a timeout turns a tab
   * that never opens into a visible error instead of a lost click.
   *
   * `expectedTabId` is the id returned by `openAiWorkspace`. Binding the arm to
   * that tab is what keeps a user tab switch from starting the picker on the
   * wrong view; without a target the tab active at arm time is pinned instead.
   */
  const startPickerWhenReady = useCallback(
    async (expectedTabId?: string) => {
      requestSeqRef.current += 1
      pendingPickerStartRef.current = true
      pendingTargetTabIdRef.current = expectedTabId ?? activeTabId ?? null
      setArmVersion((v) => v + 1)
      Logger.info(
        `[PickerLifecycle] startPickerWhenReady: armed, requestId=${requestSeqRef.current}, target=${pendingTargetTabIdRef.current ?? 'any'}`
      )

      clearArmTimeout()
      armTimeoutRef.current = setTimeout(() => {
        armTimeoutRef.current = null
        if (!pendingPickerStartRef.current) return
        cancelPendingStart()
        Logger.warn('[ElementPickerLifecycle] timed out waiting for tab content')
        showError('picker_webview_not_found')
      }, PICKER_ARM_TIMEOUT_MS)
    },
    [activeTabId, cancelPendingStart, clearArmTimeout, showError]
  )

  useEffect(() => () => cancelPendingStart(), [cancelPendingStart])

  // A picker runs inside ONE managed view. When the user switches tabs, the
  // old view keeps the picker script (and its listeners) alive while the new
  // tab shows an "active" toggle backed by nothing: the console bridge only
  // notices on the next emit, which never comes. Close the run as soon as the
  // active tab actually changes.
  //
  // `previous == null` is not a real switch (the tab id arrives
  // asynchronously after the picker starts); treating it as one would cancel a
  // freshly started pick.
  const lastActiveTabIdRef = useRef<string | undefined>(activeTabId)
  useEffect(() => {
    const previous = lastActiveTabIdRef.current
    lastActiveTabIdRef.current = activeTabId
    if (previous == null || activeTabId == null || previous === activeTabId) return

    // An armed start that no longer points at the active tab must die here
    // instead of firing later against whatever view is in front (or burning
    // the full arm timeout while the user is somewhere else).
    if (pendingPickerStartRef.current) {
      const targetTabId = pendingTargetTabIdRef.current
      if (targetTabId && activeTabId !== targetTabId) {
        Logger.info('[PickerLifecycle] armed tab changed before content was ready; cancelling', {
          targetTabId,
          activeTabId
        })
        cancelPendingStart()
      }
    }

    if (!isPickerActive) return
    Logger.info('[PickerLifecycle] active tab changed while picker is active; stopping picker', {
      previous,
      activeTabId
    })
    void pickerStopPicker().catch((error) => {
      Logger.warn('[PickerLifecycle] failed to stop picker after tab change:', error)
    })
  }, [activeTabId, cancelPendingStart, isPickerActive, pickerStopPicker])

  useEffect(() => {
    if (!pendingPickerStartRef.current) return

    // Do not inject into a tab the arm was not meant for. For the settings
    // re-pick flow the target tab may only become active a few renders later;
    // after that the effect re-runs through `activeTabId`.
    const targetTabId = pendingTargetTabIdRef.current
    if (targetTabId && activeTabId !== targetTabId) return

    const currentInstance = getContentController()
    if (!currentInstance) {
      return
    }

    let cancelled = false

    const controller = new AbortController()
    lifecycleAbortRef.current = controller

    const runLifecycle = async () => {
      try {
        const mod = pickerModRef.current
        if (!mod) {
          const loadedMod = await loadReadinessModule()
          if (cancelled) return
          await runPickerLifecycle(loadedMod, controller.signal)
        } else {
          await runPickerLifecycle(mod, controller.signal)
        }
      } catch (error) {
        if (isAbortError(error) || cancelled) {
          return
        }
        const message = ensureErrorMessage(error)
        Logger.warn('[ElementPickerLifecycle] lifecycle failed:', message)
        clearPendingRequest(requestSeqRef.current)
      }
    }

    const runPickerLifecycle = async (
      mod: NonNullable<typeof pickerModRef.current>,
      signal: AbortSignal
    ) => {
      const controller = currentInstance!
      const requestId = requestSeqRef.current
      await mod.waitForContentReady(controller, signal)

      if (cancelled || !isCurrentPendingRequest(requestId)) {
        return
      }

      if (controller.isDestroyed?.() === true) {
        clearPendingRequest(requestId)
        return
      }

      const reason = await mod.oncePickerReady(controller, signal)

      if (cancelled || !isCurrentPendingRequest(requestId)) {
        Logger.info('[ElementPickerLifecycle] stale request ignored during readiness', {
          requestId,
          reason
        })
        return
      }

      clearPendingRequest(requestId)

      try {
        await pickerStartPicker()
        Logger.info('[ElementPickerLifecycle] picker started successfully', { requestId })
      } catch (error) {
        Logger.warn('[ElementPickerLifecycle] picker start failed:', error)
        showError('picker_init_failed')
      }
    }

    void runLifecycle()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    activeTabId,
    armVersion,
    clearPendingRequest,
    hasActiveContent,
    isCurrentPendingRequest,
    getContentController,
    loadReadinessModule,
    showError,
    pickerStartPicker
  ])

  return {
    isPickerActive,
    startPicker: pickerStartPicker,
    startPickerWhenReady,
    togglePicker
  }
}
