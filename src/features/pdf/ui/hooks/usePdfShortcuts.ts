import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'

import { isMacPlatform } from '@shared/lib/shortcutUtils'

import { useEffect, useRef } from 'react'

import { usePdfSearchStore } from './usePdfSearchStore'

interface UsePdfShortcutsOptions {
  /** Invoked on Ctrl/Cmd+O — must be the app's existing handleSelectPdf flow. */
  onSelectPdf?: () => void
  /** Override for tests; defaults to real platform detection. */
  isMac?: boolean
}

/**
 * App-level PDF keyboard shortcuts (renderer only — no Electron
 * globalShortcut, so these fire only while the app window is focused).
 *
 * - Ctrl/Cmd+O → the existing handleSelectPdf() flow (opens the file picker).
 * - Ctrl/Cmd+F → opens/focuses the PDF toolbar search bar, but only while an
 *   active PDF document is loaded (no-op otherwise).
 *
 * preventDefault is called only when QuizLab actually handles the key, so
 * unrelated defaults (e.g. browser find while no PDF is open) keep working.
 * The listener lives on `window`, so the shortcuts are global to the app —
 * including while focus sits in an input/textarea. This matches the Ctrl+F
 * badge advertised next to the PDF search bar; the search input itself never
 * consumes Ctrl+F, so pressing it there is an idempotent no-op.
 */
export function usePdfShortcuts({ onSelectPdf, isMac = isMacPlatform() }: UsePdfShortcutsOptions) {
  const canOpenSearch = usePdfTabStore((s) => {
    const tab = s.pdfTabs.find((t) => t.id === s.activePdfTabId)
    return tab?.kind === 'pdf' && !!tab.file
  })
  const openSearch = usePdfSearchStore((s) => s.open)

  const onSelectPdfRef = useRef(onSelectPdf)
  onSelectPdfRef.current = onSelectPdf
  const openSearchRef = useRef(openSearch)
  openSearchRef.current = openSearch
  const canOpenSearchRef = useRef(canOpenSearch)
  canOpenSearchRef.current = canOpenSearch

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.shiftKey) return
      const isCommandPressed = isMac
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey
      if (!isCommandPressed) return

      switch (event.key.toLowerCase()) {
        case 'o':
          if (!onSelectPdfRef.current) return
          event.preventDefault()
          onSelectPdfRef.current()
          break
        case 'f':
          if (!canOpenSearchRef.current) return
          event.preventDefault()
          openSearchRef.current()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMac])
}
