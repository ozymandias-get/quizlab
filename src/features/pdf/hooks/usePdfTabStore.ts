import { GOOGLE_DRIVE_WEB_APP } from '@shared-core/constants/google-ai-web-apps'
import type { PdfFile } from '@shared-core/types'

import { useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import type { PdfTab } from './types'

const createViewerSessionKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `vs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

const normalizeTitle = (title?: string): string | undefined => {
  const normalized = title?.trim()
  return normalized || undefined
}

const toPdfFile = (file: PdfFile): PdfFile => ({
  name: file.name,
  path: file.path,
  streamUrl: file.streamUrl,
  size: file.size
})

/**
 * Checks if two PDF files represent the same stream identity (source path and stream URL).
 */
const isSamePdfStream = (prev: PdfFile | null | undefined, next: PdfFile): boolean => {
  if (!prev) return false
  return (
    (prev.path ?? '') === (next.path ?? '') && (prev.streamUrl ?? '') === (next.streamUrl ?? '')
  )
}

/**
 * Compares two PDF files for full equality of all properties.
 */
const isSamePdfFull = (a: PdfFile | null | undefined, b: PdfFile): boolean => {
  if (!a) return false
  return (
    (a.path ?? '') === (b.path ?? '') &&
    (a.streamUrl ?? '') === (b.streamUrl ?? '') &&
    (a.name ?? '') === (b.name ?? '') &&
    (a.size ?? null) === (b.size ?? null)
  )
}

interface PdfTabState {
  pdfTabs: PdfTab[]
  activePdfTabId: string
}

interface PdfTabActions {
  openPdfInTab: (file: PdfFile) => PdfTab
  setActivePdfTab: (tabId: string) => void
  closePdfTab: (tabId: string) => void
  addEmptyPdfTab: () => void
  goToPdfHome: () => void
  openGoogleDriveTab: () => void
  renamePdfTab: (tabId: string, title?: string) => void
}

type PdfTabStore = PdfTabState & PdfTabActions

/**
 * Resets the PDF tab store to its initial empty state. Test-only helper.
 */
export const resetPdfTabStore = (): void => {
  usePdfTabStore.setState({ pdfTabs: [], activePdfTabId: '' })
}

/**
 * Singleton zustand store for PDF tab state.
 *
 * Why zustand instead of a useState-based hook:
 * The previous implementation lived inside a regular React hook, so every
 * consumer (LeftPanel, ToolsPanel, FocusOverlay, etc.) ended up with its
 * own isolated state. This caused downstream components (notably the
 * BottomBar PDF Focus button and the FocusOverlay PDF body) to think no
 * PDF was ever open, even when the LeftPanel had one loaded. Sharing the
 * store across the whole tree fixes that class of bug.
 */
export const usePdfTabStore = create<PdfTabStore>((set, get) => ({
  pdfTabs: [],
  activePdfTabId: '',

  openPdfInTab: (file) => {
    const normalizedFile = toPdfFile(file)
    const normalizedPath = normalizedFile.path || null
    const { pdfTabs: currentTabs, activePdfTabId: currentActiveId } = get()

    const existingTab = normalizedPath
      ? currentTabs.find((tab) => tab.file?.path === normalizedPath)
      : undefined

    if (existingTab) {
      if (
        existingTab.file &&
        isSamePdfFull(existingTab.file, normalizedFile) &&
        currentActiveId === existingTab.id
      ) {
        return existingTab
      }

      const identityUnchanged = isSamePdfStream(existingTab.file, normalizedFile)
      const nextViewerSessionKey = identityUnchanged
        ? (existingTab.viewerSessionKey ?? createViewerSessionKey())
        : createViewerSessionKey()

      const updatedTab: PdfTab = {
        ...existingTab,
        file: normalizedFile,
        kind: 'pdf',
        webviewUrl: undefined,
        viewerSessionKey: nextViewerSessionKey
      }

      set({
        pdfTabs: currentTabs.map((tab) => (tab.id === existingTab.id ? updatedTab : tab)),
        activePdfTabId: existingTab.id
      })
      return updatedTab
    }

    const activeTab = currentTabs.find((tab) => tab.id === currentActiveId)
    if (activeTab && activeTab.file === null && activeTab.kind !== 'drive') {
      const viewerSessionKey = createViewerSessionKey()
      const updatedTab: PdfTab = {
        ...activeTab,
        file: normalizedFile,
        kind: 'pdf',
        webviewUrl: undefined,
        viewerSessionKey
      }
      set({
        pdfTabs: currentTabs.map((tab) => (tab.id === activeTab.id ? updatedTab : tab)),
        activePdfTabId: activeTab.id
      })
      return updatedTab
    }

    const newTabId = createViewerSessionKey()
    const viewerSessionKey = createViewerSessionKey()
    const newTab: PdfTab = { id: newTabId, file: normalizedFile, kind: 'pdf', viewerSessionKey }
    set({
      pdfTabs: [...currentTabs, newTab],
      activePdfTabId: newTabId
    })
    return newTab
  },

  setActivePdfTab: (tabId) => {
    if (get().activePdfTabId === tabId) return
    if (!get().pdfTabs.some((item) => item.id === tabId)) return
    set({ activePdfTabId: tabId })
  },

  closePdfTab: (tabId) => {
    const { pdfTabs } = get()
    const tabIndex = pdfTabs.findIndex((tab) => tab.id === tabId)
    if (tabIndex < 0) return

    const nextTabs = pdfTabs.filter((tab) => tab.id !== tabId)
    const { activePdfTabId: currentActiveId } = get()
    const nextActiveId =
      currentActiveId !== tabId
        ? currentActiveId
        : (nextTabs[Math.max(0, tabIndex - 1)] || nextTabs[0])?.id || ''

    set({ pdfTabs: nextTabs, activePdfTabId: nextActiveId })
  },

  addEmptyPdfTab: () => {
    const newTabId = createViewerSessionKey()
    set((state) => ({
      pdfTabs: [...state.pdfTabs, { id: newTabId, file: null, kind: 'pdf' }],
      activePdfTabId: newTabId
    }))
  },

  goToPdfHome: () => {
    const { pdfTabs } = get()
    if (pdfTabs.length === 0) {
      get().addEmptyPdfTab()
      return
    }

    const pdfLanding = pdfTabs.find((tab) => !tab.file && tab.kind === 'pdf')
    if (pdfLanding) {
      set({ activePdfTabId: pdfLanding.id })
      return
    }

    get().addEmptyPdfTab()
  },

  openGoogleDriveTab: () => {
    const { pdfTabs: currentTabs, activePdfTabId: currentActiveId } = get()

    const existingTab = currentTabs.find((tab) => tab.kind === 'drive')
    if (existingTab) {
      if (currentActiveId !== existingTab.id) {
        set({ activePdfTabId: existingTab.id })
      }
      return
    }

    const activeTab = currentTabs.find((tab) => tab.id === currentActiveId)
    const driveTabId =
      activeTab && activeTab.file === null ? activeTab.id : createViewerSessionKey()

    const driveTab: PdfTab = {
      id: driveTabId,
      file: null,
      kind: 'drive',
      title: GOOGLE_DRIVE_WEB_APP.name,
      webviewUrl: GOOGLE_DRIVE_WEB_APP.url
    }

    if (activeTab && activeTab.file === null) {
      set({
        pdfTabs: currentTabs.map((tab) => (tab.id === activeTab.id ? driveTab : tab)),
        activePdfTabId: activeTab.id
      })
    } else {
      set({
        pdfTabs: [...currentTabs, driveTab],
        activePdfTabId: driveTab.id
      })
    }
  },

  renamePdfTab: (tabId, title) => {
    const normalizedTitle = normalizeTitle(title)
    set((state) => ({
      pdfTabs: state.pdfTabs.map((tab) =>
        tab.id === tabId && tab.title !== normalizedTitle ? { ...tab, title: normalizedTitle } : tab
      )
    }))
  }
}))

/**
 * Backwards-compatible hook that returns the PDF tab state with derived
 * `activeTab` and `pdfFile` values, matching the previous useState-based API.
 */
export const usePdfTabState = () => {
  // Use a single subscription for state values (which change), and individual
  // subscriptions for stable action references. This minimizes re-renders.
  const { pdfTabs, activePdfTabId } = usePdfTabStore(
    useShallow((s) => ({
      pdfTabs: s.pdfTabs,
      activePdfTabId: s.activePdfTabId
    }))
  )
  const setActivePdfTab = usePdfTabStore((s) => s.setActivePdfTab)
  const openPdfInTab = usePdfTabStore((s) => s.openPdfInTab)
  const closePdfTab = usePdfTabStore((s) => s.closePdfTab)
  const addEmptyPdfTab = usePdfTabStore((s) => s.addEmptyPdfTab)
  const goToPdfHome = usePdfTabStore((s) => s.goToPdfHome)
  const openGoogleDriveTab = usePdfTabStore((s) => s.openGoogleDriveTab)
  const renamePdfTab = usePdfTabStore((s) => s.renamePdfTab)

  const activeTab = useMemo(() => {
    if (!activePdfTabId) return null
    return pdfTabs.find((tab) => tab.id === activePdfTabId) || null
  }, [pdfTabs, activePdfTabId])

  const pdfFile = useMemo(() => {
    return activeTab?.kind === 'drive' ? null : activeTab?.file || null
  }, [activeTab])

  return {
    pdfTabs,
    activePdfTabId,
    activePdfTab: activeTab,
    pdfFile,
    setActivePdfTab,
    openPdfInTab,
    closePdfTab,
    addEmptyPdfTab,
    goToPdfHome,
    openGoogleDriveTab,
    renamePdfTab
  }
}
