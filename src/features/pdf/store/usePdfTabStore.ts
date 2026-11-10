import { GOOGLE_DRIVE_WEB_APP } from '@shared-core/constants/googleAiWebApps'

import { revokeObjectUrl } from '@platform/electron/browserApiUtils'

import { useToastStore } from '@shared/stores/toastStore'

import { create } from 'zustand'

import type { PdfTab } from '../hooks/types'
import { isSamePdfPath } from '../lib/pdfPathIdentity'
import type { PdfTabStore } from './pdfTabStoreUtils'
import {
  createViewerSessionKey,
  isSamePdfDocument,
  isSamePdfFull,
  normalizeTitle,
  toPdfFile
} from './pdfTabStoreUtils'

/** Undo window shown on a tab close, matching every other undo toast. */
const TAB_UNDO_TOAST_MS = 5000
/**
 * Blob sources outlive the toast on purpose: the toast pauses on hover/focus,
 * so dismissing it at 5 s and revoking at 5 s would race a late "Undo" click.
 * The source is still released without the user doing anything.
 */
const CLOSED_TAB_SOURCE_RETENTION_MS = 30_000

const pendingSourceRevokes = new Map<string, ReturnType<typeof setTimeout>>()

function cancelSourceRevoke(url: string | null | undefined): void {
  if (!url) return
  const timer = pendingSourceRevokes.get(url)
  if (timer === undefined) return
  clearTimeout(timer)
  pendingSourceRevokes.delete(url)
}

function scheduleSourceRevoke(url: string): void {
  cancelSourceRevoke(url)
  const timer = setTimeout(() => {
    pendingSourceRevokes.delete(url)
    revokeObjectUrl(url)
  }, CLOSED_TAB_SOURCE_RETENTION_MS)
  pendingSourceRevokes.set(url, timer)
}

/** Picks the human name a close toast should show. */
function closedTabLabel(tab: PdfTab): string {
  return tab.title?.trim() || tab.file?.name || (tab.kind === 'drive' ? 'Google Drive' : 'PDF')
}

/**
 * Resets the PDF tab store to its initial empty state. Test-only helper.
 */
export function resetPdfTabStore(): void {
  for (const timer of pendingSourceRevokes.values()) clearTimeout(timer)
  pendingSourceRevokes.clear()
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
      ? currentTabs.find((tab) => isSamePdfPath(tab.file?.path, normalizedPath))
      : undefined

    if (existingTab) {
      if (
        existingTab.file &&
        isSamePdfFull(existingTab.file, normalizedFile) &&
        currentActiveId === existingTab.id
      ) {
        return existingTab
      }

      // The replaced document is dropped: revoke its blob URL unless another
      // tab still references the same stream.
      if (
        existingTab.file?.streamUrl?.startsWith('blob:') &&
        existingTab.file.streamUrl !== normalizedFile.streamUrl
      ) {
        const stillReferenced = currentTabs.some(
          (tab) => tab.id !== existingTab.id && tab.file?.streamUrl === existingTab.file?.streamUrl
        )
        if (!stillReferenced) {
          revokeObjectUrl(existingTab.file.streamUrl)
        }
      }

      const isIdentityUnchanged = isSamePdfDocument(existingTab.file, normalizedFile)
      const nextViewerSessionKey = isIdentityUnchanged
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
    if (!get().pdfTabs.some((tab) => tab.id === tabId)) return
    set({ activePdfTabId: tabId })
  },

  closePdfTab: (tabId) => {
    const { pdfTabs } = get()
    const tabIndex = pdfTabs.findIndex((tab) => tab.id === tabId)
    if (tabIndex < 0) return

    const closedTab = pdfTabs[tabIndex]
    if (!closedTab) return
    const nextTabs = pdfTabs.filter((tab) => tab.id !== tabId)
    const { activePdfTabId: currentActiveId } = get()
    const wasActive = currentActiveId === tabId
    const nextActiveId = !wasActive
      ? currentActiveId
      : (nextTabs[Math.max(0, tabIndex - 1)] || nextTabs[0])?.id || ''

    set({ pdfTabs: nextTabs, activePdfTabId: nextActiveId })

    // The closed tab's document is released — but not before the undo toast has
    // run out. The retention map is simply the deferred half of the same release,
    // so there is only one answer to "which blob is still alive", and a restore
    // cancels the pending release.
    const closedUrl = closedTab.file?.streamUrl
    const holdsBlob = !!closedUrl?.startsWith('blob:')
    const stillReferenced = holdsBlob && nextTabs.some((tab) => tab.file?.streamUrl === closedUrl)
    if (holdsBlob && closedUrl && !stillReferenced) scheduleSourceRevoke(closedUrl)

    const toastId = useToastStore.getState().addToast({
      type: 'info',
      message: 'pdf_tab_closed',
      params: { name: closedTabLabel(closedTab) },
      duration: TAB_UNDO_TOAST_MS,
      actionLabel: 'undo',
      onAction: () => {
        get().restorePdfTab(closedTab, { index: tabIndex, activate: wasActive })
      }
    })

    // No toast means no undo (that notification type is switched off): release
    // the source now instead of holding it for a window nobody can use.
    if (!toastId && holdsBlob && closedUrl && !stillReferenced) {
      cancelSourceRevoke(closedUrl)
      revokeObjectUrl(closedUrl)
    }
  },

  restorePdfTab: (tab, { index, activate = false } = {}) => {
    cancelSourceRevoke(tab.file?.streamUrl)

    const { pdfTabs, activePdfTabId } = get()
    if (pdfTabs.some((existing) => existing.id === tab.id)) {
      if (activate) set({ activePdfTabId: tab.id })
      return
    }

    const nextTabs = [...pdfTabs]
    const insertAt = Math.min(Math.max(index ?? nextTabs.length, 0), nextTabs.length)
    nextTabs.splice(insertAt, 0, tab)

    set({
      pdfTabs: nextTabs,
      activePdfTabId: activate ? tab.id : activePdfTabId
    })
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
    const targetTab = get().pdfTabs.find((tab) => tab.id === tabId)
    // Same early return as `setActivePdfTab`/`closePdfTab`: `map` always hands
    // back a fresh array, so a no-op rename would still swap the `pdfTabs`
    // reference and re-render every subscriber (FocusPdfBody -> App ->
    // MainWorkspace -> LeftPanel -> PdfTabStrip -> OverflowMenu).
    if (!targetTab || targetTab.title === normalizedTitle) return
    set((state) => ({
      pdfTabs: state.pdfTabs.map((tab) =>
        tab.id === tabId ? { ...tab, title: normalizedTitle } : tab
      )
    }))
  }
}))
