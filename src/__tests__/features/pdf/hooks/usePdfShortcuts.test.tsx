import type { PdfFile } from '@shared-core/types'

import { resetPdfTabStore, usePdfTabStore } from '@features/pdf/store/usePdfTabStore'
import { resetPdfSearchStore, usePdfSearchStore } from '@features/pdf/ui/hooks/usePdfSearchStore'
import { usePdfShortcuts } from '@features/pdf/ui/hooks/usePdfShortcuts'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pdfFile: PdfFile = {
  name: 'a.pdf',
  path: '/docs/a.pdf',
  streamUrl: 'blob:one',
  size: 1
}

function seedActivePdfTab(file: PdfFile | null, kind: 'pdf' | 'drive' = 'pdf') {
  usePdfTabStore.setState({
    pdfTabs: [{ id: 'tab-1', file, kind }],
    activePdfTabId: 'tab-1'
  })
}

function dispatchKeyDown(init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  window.dispatchEvent(event)
  return event
}

describe('usePdfShortcuts', () => {
  beforeEach(() => {
    resetPdfTabStore()
    resetPdfSearchStore()
  })

  afterEach(() => {
    resetPdfSearchStore()
  })

  it('triggers onSelectPdf once per Ctrl+O press and preventDefaults', () => {
    const onSelectPdf = vi.fn()
    renderHook(() => usePdfShortcuts({ onSelectPdf }))

    const event = dispatchKeyDown({ key: 'o', ctrlKey: true })
    const second = dispatchKeyDown({ key: 'o', ctrlKey: true })

    expect(onSelectPdf).toHaveBeenCalledTimes(2)
    expect(event.defaultPrevented).toBe(true)
    expect(second.defaultPrevented).toBe(true)
  })

  it('uses Cmd+O on macOS and ignores plain Ctrl+O', () => {
    const onSelectPdf = vi.fn()
    renderHook(() => usePdfShortcuts({ onSelectPdf, isMac: true }))

    dispatchKeyDown({ key: 'o', metaKey: true })
    expect(onSelectPdf).toHaveBeenCalledTimes(1)

    dispatchKeyDown({ key: 'o', ctrlKey: true })
    dispatchKeyDown({ key: 'o', metaKey: true, ctrlKey: true })
    expect(onSelectPdf).toHaveBeenCalledTimes(1)
  })

  it('opens the PDF search when Ctrl+F is pressed with an active PDF', () => {
    seedActivePdfTab(pdfFile)
    renderHook(() => usePdfShortcuts({}))

    const event = dispatchKeyDown({ key: 'f', ctrlKey: true })

    expect(usePdfSearchStore.getState().isOpen).toBe(true)
    expect(event.defaultPrevented).toBe(true)
  })

  it('opens the PDF search for Cmd+F on macOS with an active PDF', () => {
    seedActivePdfTab(pdfFile)
    renderHook(() => usePdfShortcuts({ isMac: true }))

    dispatchKeyDown({ key: 'f', metaKey: true })

    expect(usePdfSearchStore.getState().isOpen).toBe(true)
  })

  it('does nothing for Ctrl+F without an active PDF and does not preventDefault', () => {
    renderHook(() => usePdfShortcuts({}))

    const event = dispatchKeyDown({ key: 'f', ctrlKey: true })

    expect(usePdfSearchStore.getState().isOpen).toBe(false)
    expect(event.defaultPrevented).toBe(false)
  })

  it('does nothing for Ctrl+F when the active tab is a drive tab', () => {
    seedActivePdfTab(null, 'drive')
    renderHook(() => usePdfShortcuts({}))

    const event = dispatchKeyDown({ key: 'f', ctrlKey: true })

    expect(usePdfSearchStore.getState().isOpen).toBe(false)
    expect(event.defaultPrevented).toBe(false)
  })

  it('does nothing for Ctrl+F when the active pdf tab has no file loaded', () => {
    seedActivePdfTab(null, 'pdf')
    renderHook(() => usePdfShortcuts({}))

    const event = dispatchKeyDown({ key: 'f', ctrlKey: true })

    expect(usePdfSearchStore.getState().isOpen).toBe(false)
    expect(event.defaultPrevented).toBe(false)
  })

  it('does nothing for unrelated keys or missing modifiers', () => {
    const onSelectPdf = vi.fn()
    seedActivePdfTab(pdfFile)
    renderHook(() => usePdfShortcuts({ onSelectPdf }))

    dispatchKeyDown({ key: 'o' })
    dispatchKeyDown({ key: 'f' })
    dispatchKeyDown({ key: 'o', ctrlKey: true, shiftKey: true })
    dispatchKeyDown({ key: 'f', ctrlKey: true, shiftKey: true })
    dispatchKeyDown({ key: 'j', ctrlKey: true })
    dispatchKeyDown({ key: 'f', ctrlKey: true, altKey: true })

    expect(onSelectPdf).not.toHaveBeenCalled()
    expect(usePdfSearchStore.getState().isOpen).toBe(false)
  })

  it('ignores repeated keydown events', () => {
    const onSelectPdf = vi.fn()
    renderHook(() => usePdfShortcuts({ onSelectPdf }))

    dispatchKeyDown({ key: 'o', ctrlKey: true, repeat: true })

    expect(onSelectPdf).not.toHaveBeenCalled()
  })

  it('removes the listener on unmount and never fires twice after remount', () => {
    const onSelectPdf = vi.fn()
    const { unmount } = renderHook(() => usePdfShortcuts({ onSelectPdf }))

    unmount()
    dispatchKeyDown({ key: 'o', ctrlKey: true })
    expect(onSelectPdf).not.toHaveBeenCalled()

    renderHook(() => usePdfShortcuts({ onSelectPdf }))
    dispatchKeyDown({ key: 'o', ctrlKey: true })

    expect(onSelectPdf).toHaveBeenCalledTimes(1)
  })

  it('keeps calling the latest onSelectPdf reference across rerenders', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onSelectPdf }) => usePdfShortcuts({ onSelectPdf }), {
      initialProps: { onSelectPdf: first }
    })

    rerender({ onSelectPdf: second })
    act(() => {
      dispatchKeyDown({ key: 'o', ctrlKey: true })
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
