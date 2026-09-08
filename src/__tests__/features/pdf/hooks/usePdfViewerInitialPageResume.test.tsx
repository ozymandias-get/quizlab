import { usePdfViewerInitialPageResume } from '@features/pdf/hooks/usePdfViewerEffects'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePdfViewerInitialPageResume', () => {
  const rafQueue: FrameRequestCallback[] = []
  let nextRafId = 0

  beforeEach(() => {
    rafQueue.length = 0
    nextRafId = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb)
      nextRafId += 1
      return nextRafId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function setup() {
    const jumpToPageFromNav = vi.fn()
    const zoomToRef = { current: vi.fn() }
    const appliedResumeSyncKeyRef = { current: null as string | null }
    const utils = renderHook(
      (props: { viewerReloadKey: number }) =>
        usePdfViewerInitialPageResume({
          isDocumentReady: true,
          pdfUrl: 'local-pdf://doc-1',
          initialPage: 5,
          viewerReloadKey: props.viewerReloadKey,
          fitScale: 1,
          jumpToPageFromNav,
          zoomToRef,
          appliedResumeSyncKeyRef
        }),
      { initialProps: { viewerReloadKey: 0 } }
    )
    return { ...utils, jumpToPageFromNav }
  }

  function runQueuedFrames() {
    act(() => {
      rafQueue.splice(0).forEach((cb) => cb(0))
    })
  }

  it('jumps to the resume page after three frames while mounted', () => {
    const { jumpToPageFromNav } = setup()

    expect(rafQueue.length).toBe(1)
    runQueuedFrames()
    expect(jumpToPageFromNav).not.toHaveBeenCalled()
    runQueuedFrames()
    expect(jumpToPageFromNav).not.toHaveBeenCalled()
    runQueuedFrames()
    expect(jumpToPageFromNav).toHaveBeenCalledTimes(1)
    expect(jumpToPageFromNav).toHaveBeenCalledWith(5)
  })

  it('never jumps after unmount, even when frames already fired', () => {
    const { jumpToPageFromNav, unmount } = setup()

    // First frame fires and schedules the rest, then the viewer goes away.
    runQueuedFrames()
    act(() => {
      unmount()
    })

    // Draining the leftover queue must not trigger the jump.
    runQueuedFrames()
    runQueuedFrames()
    expect(jumpToPageFromNav).not.toHaveBeenCalled()
  })
})
