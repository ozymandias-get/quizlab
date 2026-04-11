import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { PdfFile } from '@shared-core/types'
import { GOOGLE_DRIVE_WEB_APP } from '@shared-core/constants/google-ai-web-apps'
import type { PdfTab } from './types'

const createViewerSessionKey = () => crypto.randomUUID()

const normalizeTitle = (title?: string): string | undefined => {
  const normalized = title?.trim()
  return normalized ? normalized : undefined
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

/**
 * Hook to manage PDF tab state and persistence.
 */
export const usePdfTabStore = () => {
  const [pdfTabs, setPdfTabs] = useState<PdfTab[]>([])
  const [activePdfTabId, setActivePdfTabId] = useState<string>('')

  // Ref-sync for use in callbacks to avoid stale closures while keeping the API clean
  const stateRef = useRef({ pdfTabs, activePdfTabId })

  useEffect(() => {
    stateRef.current = { pdfTabs, activePdfTabId }
  }, [pdfTabs, activePdfTabId])

  const openPdfInTab = useCallback((file: PdfFile): PdfTab => {
    const normalizedFile = toPdfFile(file)
    const normalizedPath = normalizedFile.path || null
    const { pdfTabs: currentTabs, activePdfTabId: currentActiveId } = stateRef.current

    const existingTab = normalizedPath
      ? currentTabs.find((tab) => tab.file?.path === normalizedPath)
      : undefined

    if (existingTab) {
      // If full file matches and it's already active, do nothing
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

      setPdfTabs(currentTabs.map((tab) => (tab.id === existingTab.id ? updatedTab : tab)))
      setActivePdfTabId(existingTab.id)
      return updatedTab
    }

    // Check if current active tab is empty, if so, use it
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
      setPdfTabs(currentTabs.map((tab) => (tab.id === activeTab.id ? updatedTab : tab)))
      return updatedTab
    }

    // Create new tab
    const newTabId = crypto.randomUUID()
    const viewerSessionKey = createViewerSessionKey()
    const newTab: PdfTab = { id: newTabId, file: normalizedFile, kind: 'pdf', viewerSessionKey }
    setPdfTabs([...currentTabs, newTab])
    setActivePdfTabId(newTabId)
    return newTab
  }, [])

  const setActivePdfTab = useCallback((tabId: string) => {
    if (stateRef.current.activePdfTabId === tabId) return
    const tabExists = stateRef.current.pdfTabs.some((item) => item.id === tabId)
    if (tabExists) {
      setActivePdfTabId(tabId)
    }
  }, [])

  const closePdfTab = useCallback((tabId: string) => {
    setPdfTabs((prevTabs) => {
      const tabIndex = prevTabs.findIndex((tab) => tab.id === tabId)
      if (tabIndex < 0) return prevTabs

      const nextTabs = prevTabs.filter((tab) => tab.id !== tabId)

      setActivePdfTabId((currentActiveId) => {
        if (currentActiveId !== tabId) return currentActiveId
        const fallbackTab = nextTabs[Math.max(0, tabIndex - 1)] || nextTabs[0]
        return fallbackTab?.id || ''
      })

      return nextTabs
    })
  }, [])

  const addEmptyPdfTab = useCallback(() => {
    const newTabId = crypto.randomUUID()
    setPdfTabs((prev) => [...prev, { id: newTabId, file: null, kind: 'pdf' }])
    setActivePdfTabId(newTabId)
  }, [])

  const goToPdfHome = useCallback(() => {
    const list = stateRef.current.pdfTabs
    if (list.length === 0) {
      addEmptyPdfTab()
      return
    }

    const pdfLanding = list.find((tab) => !tab.file && tab.kind === 'pdf')
    if (pdfLanding) {
      setActivePdfTabId(pdfLanding.id)
      return
    }

    addEmptyPdfTab()
  }, [addEmptyPdfTab])

  const openGoogleDriveTab = useCallback(() => {
    const { pdfTabs: currentTabs, activePdfTabId: currentActiveId } = stateRef.current

    const existingTab = currentTabs.find((tab) => tab.kind === 'drive')
    if (existingTab) {
      if (currentActiveId !== existingTab.id) {
        setActivePdfTabId(existingTab.id)
      }
      return
    }

    const activeTab = currentTabs.find((tab) => tab.id === currentActiveId)
    const driveTabId = activeTab && activeTab.file === null ? activeTab.id : crypto.randomUUID()

    const driveTab: PdfTab = {
      id: driveTabId,
      file: null,
      kind: 'drive',
      title: GOOGLE_DRIVE_WEB_APP.name,
      webviewUrl: GOOGLE_DRIVE_WEB_APP.url
    }

    if (activeTab && activeTab.file === null) {
      setPdfTabs(currentTabs.map((tab) => (tab.id === activeTab.id ? driveTab : tab)))
      setActivePdfTabId(activeTab.id)
    } else {
      setPdfTabs([...currentTabs, driveTab])
      setActivePdfTabId(driveTab.id)
    }
  }, [])

  const renamePdfTab = useCallback((tabId: string, title?: string) => {
    const normalizedTitle = normalizeTitle(title)
    setPdfTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId && tab.title !== normalizedTitle ? { ...tab, title: normalizedTitle } : tab
      )
    )
  }, [])

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
    setPdfTabs,
    setActivePdfTab,
    openPdfInTab,
    closePdfTab,
    addEmptyPdfTab,
    goToPdfHome,
    openGoogleDriveTab,
    renamePdfTab
  }
}
