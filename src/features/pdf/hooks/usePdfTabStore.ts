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

const samePdfStreamIdentity = (prev: PdfFile | null | undefined, next: PdfFile): boolean => {
  const pPath = prev?.path ?? ''
  const nPath = next.path ?? ''
  if (pPath !== nPath) return false
  return (prev?.streamUrl ?? '') === (next.streamUrl ?? '')
}

const sameNormalizedPdfFile = (a: PdfFile | null | undefined, b: PdfFile): boolean => {
  if (!a) return false
  const na = toPdfFile(a)
  const nb = toPdfFile(b)
  return (
    (na.path ?? '') === (nb.path ?? '') &&
    (na.streamUrl ?? '') === (nb.streamUrl ?? '') &&
    (na.name ?? '') === (nb.name ?? '') &&
    (na.size ?? null) === (nb.size ?? null)
  )
}

export const usePdfTabStore = () => {
  const [pdfTabs, setPdfTabs] = useState<PdfTab[]>([])
  const [activePdfTabId, setActivePdfTabId] = useState<string>('')

  const pdfTabsRef = useRef<PdfTab[]>([])
  const activePdfTabIdRef = useRef<string>('')

  useEffect(() => {
    pdfTabsRef.current = pdfTabs
    activePdfTabIdRef.current = activePdfTabId
  }, [pdfTabs, activePdfTabId])

  const openPdfInTab = useCallback((file: PdfFile): PdfTab => {
    const normalizedFile = toPdfFile(file)
    const normalizedPath = normalizedFile.path || null
    const currentTabs = pdfTabsRef.current

    const existingTab = normalizedPath
      ? currentTabs.find((tab) => tab.file?.path === normalizedPath)
      : undefined

    if (existingTab) {
      if (
        existingTab.file &&
        sameNormalizedPdfFile(existingTab.file, normalizedFile) &&
        activePdfTabIdRef.current === existingTab.id
      ) {
        return existingTab
      }

      const identityUnchanged = samePdfStreamIdentity(existingTab.file, normalizedFile)
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
    } else {
      const currentActiveId = activePdfTabIdRef.current
      const activeTab = currentTabs.find((tab) => tab.id === currentActiveId)

      if (activeTab && activeTab.file === null) {
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
      } else {
        const newTabId = crypto.randomUUID()
        const viewerSessionKey = createViewerSessionKey()
        const newTab: PdfTab = { id: newTabId, file: normalizedFile, kind: 'pdf', viewerSessionKey }
        setPdfTabs([...currentTabs, newTab])
        setActivePdfTabId(newTabId)
        return newTab
      }
    }
  }, [])

  const setActivePdfTab = useCallback((tabId: string) => {
    if (activePdfTabIdRef.current === tabId) return
    const tab = pdfTabsRef.current.find((item) => item.id === tabId)
    if (!tab) return
    setActivePdfTabId(tabId)
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
    const list = pdfTabsRef.current
    if (list.length === 0) return

    const pdfLanding = list.find((tab) => !tab.file && tab.kind !== 'drive')
    if (pdfLanding) {
      setActivePdfTab(pdfLanding.id)
      return
    }

    addEmptyPdfTab()
  }, [setActivePdfTab, addEmptyPdfTab])

  const openGoogleDriveTab = useCallback(() => {
    const currentTabs = pdfTabsRef.current
    const existingTab = currentTabs.find((tab) => tab.kind === 'drive')
    if (existingTab) {
      if (activePdfTabIdRef.current === existingTab.id) {
        return
      }
      setActivePdfTabId(existingTab.id)
      return
    }

    const currentActiveId = activePdfTabIdRef.current
    const activeTab = currentTabs.find((tab) => tab.id === currentActiveId)
    const driveTab: PdfTab = {
      id: activeTab?.file === null ? activeTab.id : crypto.randomUUID(),
      file: null,
      kind: 'drive',
      title: GOOGLE_DRIVE_WEB_APP.name,
      webviewUrl: GOOGLE_DRIVE_WEB_APP.url
    }

    if (activeTab && activeTab.file === null) {
      setPdfTabs(currentTabs.map((tab) => (tab.id === activeTab.id ? driveTab : tab)))
      setActivePdfTabId(activeTab.id)
      return
    }

    setPdfTabs([...currentTabs, driveTab])
    setActivePdfTabId(driveTab.id)
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
