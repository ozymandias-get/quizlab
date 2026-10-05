import { reportSuppressedError } from '@shared/lib/logger'

import { useEffect, useRef } from 'react'

import { getAiViewClient } from './aiViewClient'

/**
 * Lifecycle ownership for main-process `WebContentsView`s.
 *
 * A native view has two independent owners and conflating them is what produced
 * orphaned WebContents:
 *
 * - the **lifecycle owner** creates and destroys the view. It is the content
 *   identity that outlives any single React surface: a tab that is still open,
 *   a Drive panel that still exists.
 * - the **host owner** attaches and detaches the view's geometry. It is whatever
 *   placeholder is currently mounted, which swaps on a focus-mode switch.
 *
 * React unmount only tells us about the host owner, so it must never destroy a
 * view: `Workspace -> FocusOverlay` unmounts a host while the remote content is
 * supposed to keep running. Conversely, when a content identity genuinely goes
 * away — its tab was closed, or the `maxAliveTabs` LRU evicted it — nothing
 * unmounts with a "destroy" signal, so the teardown has to be driven from the
 * owner of the identity instead.
 */

/**
 * Closes the managed view for `viewId` in the main process.
 *
 * Idempotent: the manager answers `false` for a view it does not own, so a
 * retired id can be handed over more than once (an explicit tab close *and* the
 * LRU reconciliation) without any special casing.
 */
export function retireManagedView(viewId: string): Promise<boolean> {
  const client = getAiViewClient()
  if (!client) return Promise.resolve(false)
  return client.destroy({ viewId }).catch((error: unknown) => {
    reportSuppressedError(`managedView.retire(${viewId})`, { cause: error })
    return false
  })
}

/**
 * Destroys the managed views whose content identity is no longer live.
 *
 * `liveViewIds` is the authoritative "these identities may still own a view"
 * list — the `maxAliveTabs` alive set for the AI panel, the open Drive tabs for
 * the PDF panel. An id that was live and then disappeared is retired, which is
 * what keeps the main-process view count bounded by the renderer's alive set
 * instead of growing with every tab the user has ever opened.
 *
 * This has to be mounted *above* the surfaces that own the hosts (a focus-mode
 * switch unmounts those), otherwise a transient host change would look like a
 * content close and tear down a conversation the user is still looking at.
 */
export function useManagedViewRetirement(liveViewIds: readonly string[]): void {
  // View ids are contract-validated and cannot contain a NUL, so this is an
  // unambiguous key: the effect only re-runs when the membership actually
  // changes, not on every re-render with an equivalent array.
  const liveKey = [...new Set(liveViewIds)].sort().join('\u0000')
  const retainedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const live = new Set(liveKey === '' ? [] : liveKey.split('\u0000'))
    const retired = [...retainedRef.current].filter((viewId) => !live.has(viewId))
    retainedRef.current = live
    for (const viewId of retired) void retireManagedView(viewId)
  }, [liveKey])
}
