import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Logger } from '@shared/lib/logger'
import { useToastActions, useLanguageStrings } from '@app/providers'
import type { PdfFile } from '@shared-core/types'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useSelectPdf, useRegisterPdfPath } from '@platform/electron/api/usePdfApi'
import { GOOGLE_DRIVE_WEB_APP } from '@shared-core/constants/google-ai-web-apps'

type DroppedPdfFile = File & { path?: string }

export type LastReadingInfo = {
  name: string
  page: number
  totalPages: number
  path: string
  lastOpenedAt?: number
}

export type ResumePdfResult = 'success' | 'not_found' | 'missing' | 'error'

export interface ReadingProgressUpdate {
  path: string
  page?: number
  totalPages?: number
  lastOpenedAt?: number
}

export interface PdfTab {
  id: string
  file: PdfFile | null
  title?: string
  kind?: 'pdf' | 'drive'
  webviewUrl?: string
}

const MAX_RECENT_PDFS = 24

const normalizeTitle = (title?: string): string | undefined => {
  const normalized = title?.trim()
  return normalized ? normalized : undefined
}

const sanitizeReadingInfo = (data: unknown): LastReadingInfo | null => {
  if (!data || typeof data !== 'object') return null
  const item = data as Partial<LastReadingInfo>
  if (!item.path || !item.name) return null

  const parsedLastOpenedAt =
    typeof item.lastOpenedAt === 'number' && Number.isFinite(item.lastOpenedAt)
      ? item.lastOpenedAt
      : undefined

  return {
    name: item.name,
    page: item.page || 1,
    totalPages: item.totalPages || 0,
    path: item.path,
    ...(parsedLastOpenedAt !== undefined ? { lastOpenedAt: parsedLastOpenedAt } : {})
  }
}

const parseReadingHistory = (stored: string | null): LastReadingInfo[] => {
  if (!stored) return []

  try {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      const history = parsed
        .map((item) => sanitizeReadingInfo(item))
        .filter((item): item is LastReadingInfo => Boolean(item))
      return history.slice(0, MAX_RECENT_PDFS)
    }

    const legacySingle = sanitizeReadingInfo(parsed)
    return legacySingle ? [legacySingle] : []
  } catch {
    return []
  }
}

const readReadingHistory = (): LastReadingInfo[] => {
  try {
    return parseReadingHistory(localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING))
  } catch {
    return []
  }
}

const upsertRecentHistory = (
  history: LastReadingInfo[],
  info: LastReadingInfo
): LastReadingInfo[] => {
  const filtered = history.filter((item) => item.path !== info.path)
  return [info, ...filtered].slice(0, MAX_RECENT_PDFS)
}

const toPdfFile = (file: PdfFile): PdfFile => ({
  name: file.name,
  path: file.path,
  streamUrl: file.streamUrl,
  size: file.size
})

export const usePdfSelection = () => {
  const { showError, showSuccess } = useToastActions()
  const { t } = useLanguageStrings()

  const [pdfTabs, setPdfTabs] = useState<PdfTab[]>([])
  const [activePdfTabId, setActivePdfTabId] = useState<string>('')
  const [recentReadingInfo, setRecentReadingInfo] = useState<LastReadingInfo[]>(() =>
    readReadingHistory()
  )
  const pdfTabsRef = useRef<PdfTab[]>([])
  const activePdfTabIdRef = useRef<string>('')
  const recentReadingInfoRef = useRef<LastReadingInfo[]>(recentReadingInfo)
  const readingProgressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingReadingProgressApplyRef = useRef<(() => void) | null>(null)

  const { mutateAsync: selectPdf } = useSelectPdf()
  const { mutateAsync: registerPdfPath } = useRegisterPdfPath()

  const lastLoadRequestId = useRef<number>(0)

  const persistRecentReadingInfo = useCallback((items: LastReadingInfo[]) => {
    try {
      if (items.length > 0) {
        localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(items))
      } else {
        localStorage.removeItem(STORAGE_KEYS.LAST_PDF_READING)
      }
    } catch {}

    recentReadingInfoRef.current = items
    setRecentReadingInfo(items)
  }, [])

  const upsertLastReadingInfo = useCallback(
    (info: LastReadingInfo) => {
      persistRecentReadingInfo(upsertRecentHistory(recentReadingInfoRef.current, info))
    },
    [persistRecentReadingInfo]
  )

  const updateReadingProgress = useCallback(
    (update: ReadingProgressUpdate) => {
      const { path, page, totalPages, lastOpenedAt } = update
      const current = recentReadingInfoRef.current
      const existing = current.find((item) => item.path === path)
      if (!existing) return

      const nextInfo: LastReadingInfo = {
        ...existing,
        ...(typeof page === 'number' ? { page: Math.max(1, page) } : {}),
        ...(typeof totalPages === 'number' ? { totalPages: Math.max(0, totalPages) } : {}),
        lastOpenedAt: lastOpenedAt ?? Date.now()
      }

      const applyPersist = () => {
        persistRecentReadingInfo(upsertRecentHistory(recentReadingInfoRef.current, nextInfo))
      }

      const shouldDebounce = typeof page === 'number' && typeof totalPages !== 'number'

      if (shouldDebounce) {
        pendingReadingProgressApplyRef.current = applyPersist
        if (readingProgressDebounceRef.current) {
          clearTimeout(readingProgressDebounceRef.current)
        }
        readingProgressDebounceRef.current = setTimeout(() => {
          readingProgressDebounceRef.current = null
          pendingReadingProgressApplyRef.current?.()
          pendingReadingProgressApplyRef.current = null
        }, 400)
        return
      }

      if (readingProgressDebounceRef.current) {
        clearTimeout(readingProgressDebounceRef.current)
        readingProgressDebounceRef.current = null
      }
      pendingReadingProgressApplyRef.current?.()
      pendingReadingProgressApplyRef.current = null
      applyPersist()
    },
    [persistRecentReadingInfo]
  )

  const flushPendingReadingProgress = useCallback(() => {
    if (readingProgressDebounceRef.current) {
      clearTimeout(readingProgressDebounceRef.current)
      readingProgressDebounceRef.current = null
    }
    pendingReadingProgressApplyRef.current?.()
    pendingReadingProgressApplyRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      flushPendingReadingProgress()
    }
  }, [flushPendingReadingProgress])

  useEffect(() => {
    pdfTabsRef.current = pdfTabs
    activePdfTabIdRef.current = activePdfTabId
  }, [pdfTabs, activePdfTabId])

  useEffect(() => {
    recentReadingInfoRef.current = recentReadingInfo
  }, [recentReadingInfo])

  const openPdfInTab = useCallback(
    (file: PdfFile, initialReadInfo?: LastReadingInfo) => {
      const normalizedFile = toPdfFile(file)
      const normalizedPath = normalizedFile.path || null
      const currentTabs = pdfTabsRef.current
      const existingTab = normalizedPath
        ? currentTabs.find((tab) => tab.file?.path === normalizedPath)
        : undefined

      if (existingTab) {
        setPdfTabs(
          currentTabs.map((tab) =>
            tab.id === existingTab.id
              ? { ...tab, file: normalizedFile, kind: 'pdf', webviewUrl: undefined }
              : tab
          )
        )
        setActivePdfTabId(existingTab.id)
      } else {
        const currentActiveId = activePdfTabIdRef.current
        const activeTab = currentTabs.find((tab) => tab.id === currentActiveId)
        if (activeTab && activeTab.file === null) {
          setPdfTabs(
            currentTabs.map((tab) =>
              tab.id === activeTab.id
                ? { ...tab, file: normalizedFile, kind: 'pdf', webviewUrl: undefined }
                : tab
            )
          )
        } else {
          const newTabId = crypto.randomUUID()
          setPdfTabs([...currentTabs, { id: newTabId, file: normalizedFile, kind: 'pdf' }])
          setActivePdfTabId(newTabId)
        }
      }

      if (normalizedFile.path && normalizedFile.name) {
        upsertLastReadingInfo(
          initialReadInfo || {
            name: normalizedFile.name,
            path: normalizedFile.path,
            page: 1,
            totalPages: 0,
            lastOpenedAt: Date.now()
          }
        )
      }
    },
    [upsertLastReadingInfo]
  )

  const setActivePdfTab = useCallback(
    (tabId: string) => {
      const tab = pdfTabsRef.current.find((item) => item.id === tabId)
      if (!tab) return

      setActivePdfTabId(tabId)

      if (tab.file?.path && tab.file?.name) {
        updateReadingProgress({
          path: tab.file.path,
          lastOpenedAt: Date.now()
        })
      }
    },
    [updateReadingProgress]
  )

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

  /**
   * PDF ana ekranı: açık PDF sekmelerine dokunulmaz (dosya / başlık aynı kalır).
   * Boş pdf sekmesi varsa oraya geçilir; yoksa yeni boş sekme eklenir ve odak oraya alınır.
   */
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
      prevTabs.map((tab) => (tab.id === tabId ? { ...tab, title: normalizedTitle } : tab))
    )
  }, [])

  const handleSelectPdf = useCallback(async () => {
    const currentRequestId = ++lastLoadRequestId.current

    try {
      const result = await selectPdf({ filterName: t('pdf_documents') })

      if (currentRequestId === lastLoadRequestId.current && result) {
        openPdfInTab(result)
      }
    } catch (error) {
      if (currentRequestId === lastLoadRequestId.current) {
        Logger.error('[usePdfSelection] PDF Selection Error:', error)
      }
    }
  }, [selectPdf, t, openPdfInTab])

  const handlePdfDrop = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showError('error_invalid_pdf')
        return
      }

      const filePath = (file as DroppedPdfFile).path
      if (!filePath) return

      try {
        const result = await registerPdfPath(filePath)
        if (result) {
          openPdfInTab(result)
          showSuccess('toast_opened', undefined, { fileName: result.name })
        }
      } catch (error) {
        Logger.error('[usePdfSelection] Drop Error:', error)
        showError('error_pdf_load')
      }
    },
    [registerPdfPath, showSuccess, showError, openPdfInTab]
  )

  const resumeLastPdf = useCallback(
    async (path?: string): Promise<ResumePdfResult> => {
      flushPendingReadingProgress()
      const history = recentReadingInfoRef.current
      const target = path ? history.find((item) => item.path === path) : history[0]

      if (!target) {
        return 'missing'
      }

      try {
        const result = await registerPdfPath(target.path)
        if (result) {
          openPdfInTab(result, {
            ...target,
            name: result.name || target.name,
            path: result.path || target.path,
            page: target.page || 1,
            lastOpenedAt: Date.now()
          })
          return 'success'
        }
      } catch (error) {
        Logger.error('[usePdfSelection] Resume Error:', error)
        if (path) {
          showError('recent_pdf_not_found', undefined, { fileName: target.name })
          return 'not_found'
        }
        showError('error_pdf_load')
        return 'error'
      }

      showError('error_pdf_load')
      return 'error'
    },
    [registerPdfPath, showError, openPdfInTab, flushPendingReadingProgress]
  )

  const getLastReadingInfo = useCallback((): LastReadingInfo | null => {
    return recentReadingInfoRef.current[0] || null
  }, [])

  const getRecentReadingInfo = useCallback((): LastReadingInfo[] => {
    return recentReadingInfoRef.current
  }, [])

  const clearLastReading = useCallback(
    (path?: string) => {
      if (!path) {
        persistRecentReadingInfo([])
        return
      }

      const history = recentReadingInfoRef.current.filter((item) => item.path !== path)
      persistRecentReadingInfo(history)
    },
    [persistRecentReadingInfo]
  )

  const restoreRecentReading = useCallback(
    (info: LastReadingInfo, index = 0) => {
      const history = recentReadingInfoRef.current.filter((item) => item.path !== info.path)
      const safeIndex = Math.max(0, Math.min(index, history.length))
      const restored: LastReadingInfo = {
        ...info,
        page: info.page || 1,
        totalPages: info.totalPages || 0,
        lastOpenedAt: info.lastOpenedAt ?? Date.now()
      }

      const next = [...history]
      next.splice(safeIndex, 0, restored)
      persistRecentReadingInfo(next.slice(0, MAX_RECENT_PDFS))
    },
    [persistRecentReadingInfo]
  )

  const activeTabInitialPage = useMemo(() => {
    if (!activePdfTabId) return undefined
    const activeTab = pdfTabs.find((tab) => tab.id === activePdfTabId)
    if (!activeTab || activeTab.kind !== 'pdf' || !activeTab.file?.path) return undefined

    const history = recentReadingInfoRef.current
    const existing = history.find((item) => item.path === activeTab.file?.path)
    return existing?.page
  }, [activePdfTabId, pdfTabs, recentReadingInfo])

  const pdfFile = useMemo(() => {
    if (!activePdfTabId) return null
    const activeTab = pdfTabs.find((tab) => tab.id === activePdfTabId)
    return activeTab?.kind === 'drive' ? null : activeTab?.file || null
  }, [pdfTabs, activePdfTabId])

  const activePdfTab = useMemo(() => {
    if (!activePdfTabId) return null
    return pdfTabs.find((tab) => tab.id === activePdfTabId) || null
  }, [pdfTabs, activePdfTabId])

  return {
    pdfFile,
    pdfTabs,
    activePdfTab,
    activePdfTabId,
    setActivePdfTab,
    closePdfTab,
    renamePdfTab,
    handleSelectPdf,
    handlePdfDrop,
    updateReadingProgress,
    resumeLastPdf,
    getLastReadingInfo,
    getRecentReadingInfo,
    clearLastReading,
    restoreRecentReading,
    addEmptyPdfTab,
    openGoogleDriveTab,
    activeTabInitialPage,
    goToPdfHome,
    recentReadingInfo
  }
}
