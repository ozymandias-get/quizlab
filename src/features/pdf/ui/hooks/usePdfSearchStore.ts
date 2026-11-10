import { create } from 'zustand'

interface PdfSearchUiState {
  /** Whether the PDF toolbar search bar is open. */
  isOpen: boolean
  /** The current query, scoped to `ownerId`. */
  keyword: string
  /** `Aa`: match without folding case. */
  caseSensitive: boolean
  /** Match only whole words. */
  wholeWord: boolean
  /**
   * Document that owns the current search. `null` means the bar was opened
   * without a document yet; any toolbar may claim it by typing.
   */
  ownerId: string | null
  open: (ownerId?: string | null) => void
  close: () => void
  setKeyword: (keyword: string, ownerId?: string | null) => void
  toggleCaseSensitive: () => void
  toggleWholeWord: () => void
  /** Closes the bar and forgets the query for every document. */
  reset: () => void
  /** Resets only when the given document owns (or nobody owns) the search. */
  resetOwner: (ownerId: string | null) => void
}

/**
 * Singleton zustand store for the PDF toolbar search bar state.
 *
 * The search bar is rendered per viewer instance (LeftPanel, FocusOverlay).
 * Sharing both the open state and the query through a store keeps two toolbars
 * showing the *same document* from diverging while they overlap during the
 * focus transition.
 *
 * Two viewers can also show *different* documents. `ownerId` keeps their
 * searches apart: typing in one claims the query, so the other viewer's bar
 * closes instead of showing a query whose highlights only exist in the first
 * viewer.
 */
export const usePdfSearchStore = create<PdfSearchUiState>((set) => ({
  isOpen: false,
  keyword: '',
  caseSensitive: false,
  wholeWord: false,
  ownerId: null,
  open: (ownerId) =>
    set((state) => {
      if (ownerId === undefined) return { isOpen: true }
      if (state.ownerId !== ownerId) return { isOpen: true, ownerId, keyword: '' }
      return { isOpen: true, ownerId }
    }),
  close: () => set({ isOpen: false }),
  setKeyword: (keyword, ownerId) =>
    set((state) => {
      if (ownerId === undefined || ownerId === state.ownerId) {
        return { keyword, isOpen: true }
      }
      return { keyword, isOpen: true, ownerId }
    }),
  toggleCaseSensitive: () => set((state) => ({ caseSensitive: !state.caseSensitive })),
  toggleWholeWord: () => set((state) => ({ wholeWord: !state.wholeWord })),
  reset: () =>
    set({ isOpen: false, keyword: '', caseSensitive: false, wholeWord: false, ownerId: null }),
  resetOwner: (ownerId) =>
    set((state) => {
      if (state.ownerId !== null && state.ownerId !== ownerId) return state
      return { isOpen: false, keyword: '', caseSensitive: false, wholeWord: false, ownerId: null }
    })
}))

/** Resets the PDF search UI store to its initial state. Test-only helper. */
export function resetPdfSearchStore(): void {
  usePdfSearchStore.setState({
    isOpen: false,
    keyword: '',
    caseSensitive: false,
    wholeWord: false,
    ownerId: null
  })
}
