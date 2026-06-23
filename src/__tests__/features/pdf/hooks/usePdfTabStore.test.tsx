import type { PdfFile } from '@shared-core/types'

import { resetPdfTabStore, usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePdfTabStore', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('new-tab-id')
        .mockReturnValueOnce('session-a')
        .mockReturnValueOnce('session-b')
        .mockReturnValueOnce('session-c')
    } as unknown as Crypto)
    // The store is now a zustand singleton — reset it between tests so
    // the assertions see a clean slate.
    resetPdfTabStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not update state when reopening the same normalized file on the active tab', () => {
    const fileA: PdfFile = {
      name: 'a.pdf',
      path: '/docs/a.pdf',
      streamUrl: 'blob:one',
      size: 1
    }

    const { result } = renderHook(() => usePdfTabStore())

    act(() => {
      result.current.openPdfInTab(fileA)
    })

    const tabsAfterFirst = result.current.pdfTabs

    act(() => {
      result.current.openPdfInTab(fileA)
    })

    expect(result.current.pdfTabs).toBe(tabsAfterFirst)
  })

  it('preserves viewerSessionKey when reopening the same path and streamUrl', () => {
    const fileA: PdfFile = {
      name: 'a.pdf',
      path: '/docs/a.pdf',
      streamUrl: 'blob:one',
      size: 1
    }
    const fileA2: PdfFile = {
      ...fileA,
      name: 'a-renamed.pdf',
      size: 2
    }

    const { result } = renderHook(() => usePdfTabStore())

    act(() => {
      result.current.openPdfInTab(fileA)
    })

    const firstKey = result.current.pdfTabs[0]?.viewerSessionKey
    expect(firstKey).toBe('session-a')

    act(() => {
      result.current.openPdfInTab(fileA2)
    })

    expect(result.current.pdfTabs[0]?.viewerSessionKey).toBe(firstKey)
    expect(result.current.pdfTabs[0]?.file?.name).toBe('a-renamed.pdf')
  })

  it('issues a new viewerSessionKey when streamUrl changes for the same path', () => {
    const fileA: PdfFile = {
      name: 'a.pdf',
      path: '/docs/a.pdf',
      streamUrl: 'blob:one',
      size: 1
    }
    const fileANewStream: PdfFile = {
      ...fileA,
      streamUrl: 'blob:two'
    }

    const { result } = renderHook(() => usePdfTabStore())

    act(() => {
      result.current.openPdfInTab(fileA)
    })

    expect(result.current.pdfTabs[0]?.viewerSessionKey).toBe('session-a')

    act(() => {
      result.current.openPdfInTab(fileANewStream)
    })

    expect(result.current.pdfTabs[0]?.viewerSessionKey).toBe('session-b')
  })
})
