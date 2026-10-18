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

  it.each([
    ['Ctrl+F', false, { key: 'f', ctrlKey: true }],
    ['Cmd+F on macOS', true, { key: 'f', metaKey: true }]
  ])('opens the PDF search on %s when a PDF tab is active', (_label, isMac, init) => {
    seedActivePdfTab(pdfFile)
    renderHook(() => usePdfShortcuts({ isMac }))

    const event = dispatchKeyDown(init)

    expect(usePdfSearchStore.getState().isOpen).toBe(true)
    expect(event.defaultPrevented).toBe(true)
  })

  // All three are "there is no PDF to search": the reader gets the browser's own
  // find, and this hook leaves the keystroke alone.
  it.each([
    ['no active tab', () => {}],
    ['the active tab is a drive tab', () => seedActivePdfTab(null, 'drive')],
    ['the active pdf tab has no file loaded', () => seedActivePdfTab(null, 'pdf')]
  ])('does nothing for Ctrl+F with %s', (_label, seed) => {
    seed()
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
