/**
 * PDF tab lifecycle tests.
 *
 * The PDF tab store is the central authority for which PDF a user is
 * currently viewing. It is therefore a high-regression-risk surface:
 *
 *  - Closing a tab must pick a sensible fallback (no null-deref, no
 *    dangling active-id pointing at a non-existent tab).
 *  - Renaming a tab must round-trip through state.
 *  - Adding the same file twice must dedupe by path.
 *  - Toggling the active tab must be a no-op when the id is unknown.
 *  - Drive tab id must be stable when the same drive is opened twice.
 */
import type { PdfFile } from '@shared-core/types'

import { usePdfTabState } from '@features/pdf/hooks/usePdfTabState'
import { resetPdfTabStore, usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const makeFile = (name: string, path: string, streamUrl = `blob:${name}`): PdfFile => ({
  name,
  path,
  streamUrl,
  size: 100
})

const resetStore = (): void => resetPdfTabStore()

describe('usePdfTabStore - opening PDFs', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 9)}`)
    } as unknown as Crypto)
    resetStore()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens a PDF in a brand new tab', () => {
    const { result } = renderHook(() => usePdfTabStore())

    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })

    expect(result.current.pdfTabs).toHaveLength(1)
    const tab = result.current.pdfTabs[0]
    expect(tab?.file?.name).toBe('a.pdf')
    expect(tab?.kind).toBe('pdf')
    expect(result.current.activePdfTabId).toBe(tab?.id)
  })

  it('deduplicates by path when opening the same file twice', () => {
    const { result } = renderHook(() => usePdfTabStore())
    const file = makeFile('a.pdf', '/docs/a.pdf')

    act(() => {
      result.current.openPdfInTab(file)
    })
    const firstTabId = result.current.pdfTabs[0]?.id

    act(() => {
      result.current.openPdfInTab(file)
    })

    expect(result.current.pdfTabs).toHaveLength(1)
    expect(result.current.pdfTabs[0]?.id).toBe(firstTabId)
    expect(result.current.activePdfTabId).toBe(firstTabId)
  })

  it('opens multiple files in separate tabs', () => {
    const { result } = renderHook(() => usePdfTabStore())

    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    act(() => {
      result.current.openPdfInTab(makeFile('b.pdf', '/docs/b.pdf'))
    })
    act(() => {
      result.current.openPdfInTab(makeFile('c.pdf', '/docs/c.pdf'))
    })

    expect(result.current.pdfTabs).toHaveLength(3)
    const names = result.current.pdfTabs.map((t) => t.file?.name)
    expect(names).toEqual(['a.pdf', 'b.pdf', 'c.pdf'])
  })

  it('reuses the empty active tab when one exists', () => {
    const { result } = renderHook(() => usePdfTabStore())

    act(() => {
      result.current.addEmptyPdfTab()
    })
    const emptyTabId = result.current.activePdfTabId
    expect(result.current.pdfTabs[0]?.file).toBeNull()

    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })

    expect(result.current.pdfTabs).toHaveLength(1)
    expect(result.current.pdfTabs[0]?.id).toBe(emptyTabId)
    expect(result.current.pdfTabs[0]?.file?.name).toBe('a.pdf')
  })

  it('preserves the empty tab when it is drive-kind', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openGoogleDriveTab()
    })
    const driveTabId = result.current.activePdfTabId

    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })

    // Should not overwrite the drive tab
    expect(result.current.pdfTabs).toHaveLength(2)
    const driveTab = result.current.pdfTabs.find((t) => t.id === driveTabId)
    expect(driveTab?.kind).toBe('drive')
  })

  it('updates the file on an existing tab when the path matches', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const firstTabId = result.current.pdfTabs[0]?.id

    act(() => {
      result.current.openPdfInTab({
        ...makeFile('a-renamed.pdf', '/docs/a.pdf'),
        size: 999
      })
    })

    expect(result.current.pdfTabs).toHaveLength(1)
    expect(result.current.pdfTabs[0]?.id).toBe(firstTabId)
    expect(result.current.pdfTabs[0]?.file?.name).toBe('a-renamed.pdf')
    expect(result.current.pdfTabs[0]?.file?.size).toBe(999)
  })
})

describe('usePdfTabStore - closing tabs', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 9)}`)
    } as unknown as Crypto)
    resetStore()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes the closed tab and reassigns active id', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    act(() => {
      result.current.openPdfInTab(makeFile('b.pdf', '/docs/b.pdf'))
    })
    const lastTabId = result.current.activePdfTabId

    act(() => {
      result.current.closePdfTab(lastTabId)
    })

    expect(result.current.pdfTabs).toHaveLength(1)
    expect(result.current.activePdfTabId).not.toBe(lastTabId)
    expect(result.current.activePdfTabId).toBe(result.current.pdfTabs[0]?.id)
  })

  it('does nothing when closing an unknown tab id', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const initial = result.current.pdfTabs

    act(() => {
      result.current.closePdfTab('nonexistent-id')
    })

    expect(result.current.pdfTabs).toBe(initial)
  })

  it('falls back to empty string when closing the last tab', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const id = result.current.activePdfTabId

    act(() => {
      result.current.closePdfTab(id)
    })

    expect(result.current.pdfTabs).toHaveLength(0)
    expect(result.current.activePdfTabId).toBe('')
  })

  it('prefers the previous tab when closing the active tab', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    act(() => {
      result.current.openPdfInTab(makeFile('b.pdf', '/docs/b.pdf'))
    })
    act(() => {
      result.current.openPdfInTab(makeFile('c.pdf', '/docs/c.pdf'))
    })
    const aId = result.current.pdfTabs[0]?.id
    const bId = result.current.pdfTabs[1]?.id
    const cId = result.current.pdfTabs[2]?.id

    // active = c, close c, should fall back to b
    act(() => {
      result.current.closePdfTab(cId!)
    })
    expect(result.current.activePdfTabId).toBe(bId)

    // active = b, close b, should fall back to a
    act(() => {
      result.current.closePdfTab(bId!)
    })
    expect(result.current.activePdfTabId).toBe(aId)
  })
})

describe('usePdfTabStore - renaming', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 9)}`)
    } as unknown as Crypto)
    resetStore()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renames a tab', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const id = result.current.pdfTabs[0]?.id

    act(() => {
      result.current.renamePdfTab(id!, 'My Document')
    })

    expect(result.current.pdfTabs[0]?.title).toBe('My Document')
  })

  it('clears the title when passed empty/whitespace', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const id = result.current.pdfTabs[0]?.id
    act(() => {
      result.current.renamePdfTab(id!, 'Initial')
    })
    expect(result.current.pdfTabs[0]?.title).toBe('Initial')

    act(() => {
      result.current.renamePdfTab(id!, '   ')
    })
    expect(result.current.pdfTabs[0]?.title).toBeUndefined()
  })

  it('keeps the title when re-set to the same value', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const id = result.current.pdfTabs[0]?.id
    act(() => {
      result.current.renamePdfTab(id!, 'Same')
    })
    expect(result.current.pdfTabs[0]?.title).toBe('Same')

    act(() => {
      result.current.renamePdfTab(id!, 'Same')
    })
    expect(result.current.pdfTabs[0]?.title).toBe('Same')
  })
})

describe('usePdfTabStore - setActivePdfTab', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 9)}`)
    } as unknown as Crypto)
    resetStore()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('switches the active tab', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
      result.current.openPdfInTab(makeFile('b.pdf', '/docs/b.pdf'))
    })
    const aId = result.current.pdfTabs[0]?.id

    act(() => {
      result.current.setActivePdfTab(aId!)
    })
    expect(result.current.activePdfTabId).toBe(aId)
  })

  it('no-ops when given the same id', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const id = result.current.activePdfTabId

    const before = result.current.activePdfTabId
    act(() => {
      result.current.setActivePdfTab(id)
    })
    expect(result.current.activePdfTabId).toBe(before)
  })

  it('ignores unknown ids', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const id = result.current.activePdfTabId

    act(() => {
      result.current.setActivePdfTab('unknown')
    })
    expect(result.current.activePdfTabId).toBe(id)
  })
})

describe('usePdfTabStore - goToPdfHome', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 9)}`)
    } as unknown as Crypto)
    resetStore()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates an empty tab when there are none', () => {
    const { result } = renderHook(() => usePdfTabStore())
    expect(result.current.pdfTabs).toHaveLength(0)

    act(() => {
      result.current.goToPdfHome()
    })

    expect(result.current.pdfTabs).toHaveLength(1)
    expect(result.current.pdfTabs[0]?.file).toBeNull()
  })

  it('reuses an existing empty PDF tab', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
      result.current.addEmptyPdfTab()
    })
    const emptyTabId = result.current.pdfTabs[1]?.id
    const initialLength = result.current.pdfTabs.length

    act(() => {
      result.current.goToPdfHome()
    })

    expect(result.current.pdfTabs).toHaveLength(initialLength)
    expect(result.current.activePdfTabId).toBe(emptyTabId)
  })

  it('creates a new empty tab if no empty PDF tab exists', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const initialLength = result.current.pdfTabs.length

    act(() => {
      result.current.goToPdfHome()
    })

    expect(result.current.pdfTabs.length).toBe(initialLength + 1)
    const newTab = result.current.pdfTabs[result.current.pdfTabs.length - 1]
    expect(newTab?.file).toBeNull()
    expect(newTab?.kind).toBe('pdf')
  })
})

describe('usePdfTabStore - openGoogleDriveTab', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 9)}`)
    } as unknown as Crypto)
    resetStore()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a drive tab', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openGoogleDriveTab()
    })

    const driveTab = result.current.pdfTabs.find((t) => t.kind === 'drive')
    expect(driveTab).toBeDefined()
    expect(driveTab?.file).toBeNull()
    expect(driveTab?.webviewUrl).toContain('drive.google.com')
  })

  it('reuses the existing drive tab when called twice', () => {
    const { result } = renderHook(() => usePdfTabStore())
    act(() => {
      result.current.openGoogleDriveTab()
    })
    const firstId = result.current.pdfTabs[0]?.id

    act(() => {
      result.current.openGoogleDriveTab()
    })

    expect(result.current.pdfTabs).toHaveLength(1)
    expect(result.current.pdfTabs[0]?.id).toBe(firstId)
  })
})

describe('usePdfTabStore - derived values', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 9)}`)
    } as unknown as Crypto)
    resetStore()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('activeTab reflects the active id', () => {
    const { result } = renderHook(() => usePdfTabState())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    const tab = result.current.activePdfTab
    expect(tab).not.toBeNull()
    expect(tab?.file?.name).toBe('a.pdf')
  })

  it('pdfFile is null for drive tabs', () => {
    const { result } = renderHook(() => usePdfTabState())
    act(() => {
      result.current.openGoogleDriveTab()
    })
    expect(result.current.activePdfTab?.kind).toBe('drive')
    expect(result.current.pdfFile).toBeNull()
  })

  it('pdfFile is the file for pdf tabs', () => {
    const { result } = renderHook(() => usePdfTabState())
    act(() => {
      result.current.openPdfInTab(makeFile('a.pdf', '/docs/a.pdf'))
    })
    expect(result.current.pdfFile?.name).toBe('a.pdf')
  })

  it('activeTab is null when no tab is active', () => {
    const { result } = renderHook(() => usePdfTabState())
    expect(result.current.activePdfTab).toBeNull()
    expect(result.current.pdfFile).toBeNull()
  })
})
