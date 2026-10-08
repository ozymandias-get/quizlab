/**
 * `resetReadingProgressStore` — the boot-time re-read of the recent-reading list.
 *
 * The store is built by a static import, so its initial state comes from
 * `readReadingHistory()` at **module-eval time**. In Electron that is before
 * `hydrateSettingsFromMain()` writes the main process' copy of
 * `STORAGE_KEYS.LAST_PDF_READING` into localStorage, which is why the reset is
 * called from `main.tsx`'s bootstrap and not only from tests.
 *
 * Without it the failure is not a stale list, it is data loss: the session starts
 * with an empty `recentReadingInfo`, and the first progress write persists that
 * one-entry list back over the real history — in localStorage and, through the
 * `setItem` mirror, in the main process store too.
 */
import { resetReadingProgressStore } from '@features/pdf'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'

import { renderHook } from '@testing-library/react'
import { useReadingProgressPersistence } from '@features/pdf/hooks/useReadingProgressPersistence'
import { beforeEach, describe, expect, it } from 'vitest'

const HISTORY: unknown[] = [
  { path: '/docs/a.pdf', name: 'a.pdf', page: 12, totalPages: 40 },
  { path: '/docs/b.pdf', name: 'b.pdf', page: 3, totalPages: 9 }
]

/** The store's own reader, mounted the way the app mounts it. */
function recent() {
  return renderHook(() => useReadingProgressPersistence()).result.current.recentReadingInfo
}

describe('resetReadingProgressStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('re-reads the persisted history into the already-created store', () => {
    // The store already exists and has snapshotted an empty list.
    expect(recent()).toEqual([])

    // What `hydrateSettingsFromMain()` writes during boot.
    window.localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(HISTORY))

    resetReadingProgressStore()

    expect(recent()).toHaveLength(2)
    expect(recent()[0].path).toBe('/docs/a.pdf')
  })

  it('leaves an already-hydrated store unchanged', () => {
    window.localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(HISTORY))
    resetReadingProgressStore()
    const first = recent()

    resetReadingProgressStore()

    expect(recent()).toEqual(first)
  })

  it('falls back to an empty list when the saved history is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, 'not json at all')

    resetReadingProgressStore()

    expect(recent()).toEqual([])
  })
})
