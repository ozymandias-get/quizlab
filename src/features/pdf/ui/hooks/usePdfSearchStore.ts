import { create } from 'zustand'

interface PdfSearchUiState {
  /** Whether the PDF toolbar search bar is open. */
  isOpen: boolean
  /** The current query, shared by every mounted toolbar for this document. */
  keyword: string
  open: () => void
  close: () => void
  setKeyword: (keyword: string) => void
  /** Closes the bar and forgets the query (document change / last toolbar leaving). */
  reset: () => void
}

/**
 * Singleton zustand store for the PDF toolbar search bar state.
 *
 * The search bar is rendered per viewer instance (LeftPanel, FocusOverlay),
 * but the Ctrl/Cmd+F shortcut is a single app-level listener. Sharing both the
 * open state and the query through a store lets any viewer instance react to
 * the shortcut and keeps the two toolbars from showing different queries while
 * they overlap during the focus transition.
 */
export const usePdfSearchStore = create<PdfSearchUiState>((set) => ({
  isOpen: false,
  keyword: '',
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setKeyword: (keyword) => set({ keyword }),
  reset: () => set({ isOpen: false, keyword: '' })
}))

/** Resets the PDF search UI store to its initial state. Test-only helper. */
export function resetPdfSearchStore(): void {
  usePdfSearchStore.setState({ isOpen: false, keyword: '' })
}
