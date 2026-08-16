import { create } from 'zustand'

interface PdfSearchUiState {
  /** Whether the PDF toolbar search bar is open. */
  isOpen: boolean
  open: () => void
  close: () => void
}

/**
 * Singleton zustand store for the PDF toolbar search bar open state.
 *
 * The search bar is rendered per viewer instance (LeftPanel, FocusOverlay),
 * but the Ctrl/Cmd+F shortcut is a single app-level listener. Sharing the
 * state through a store lets any viewer instance react to the shortcut
 * without duplicating the keydown handler.
 */
export const usePdfSearchStore = create<PdfSearchUiState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false })
}))

/** Resets the PDF search UI store to its initial state. Test-only helper. */
export function resetPdfSearchStore(): void {
  usePdfSearchStore.setState({ isOpen: false })
}
