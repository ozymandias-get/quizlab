import { usePdfOpenActions } from '@features/pdf/hooks/usePdfOpenActions'
import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'
import { useReadingProgressPersistence } from '@features/pdf/hooks/useReadingProgressPersistence'
import type { ReadingProgressUpdate, ResumePdfResult } from '@features/pdf/types'

import { useTextSelection } from '@app/hooks/useTextSelection'
import ErrorBoundary from '@ui/components/ErrorBoundary'

import { lazy, memo, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const PdfTabStrip = lazy(() =>
  import('@features/pdf/viewer').then((m) => ({ default: m.PdfTabStrip }))
)
const PdfViewer = lazy(() => import('@features/pdf/viewer').then((m) => ({ default: m.PdfViewer })))

const FocusPdfBody = memo(function FocusPdfBody() {
  const { t } = useTranslation()
  const { handleTextSelection } = useTextSelection()

  const pdfTabs = usePdfTabStore((s) => s.pdfTabs)
  const activePdfTabId = usePdfTabStore((s) => s.activePdfTabId)
  const setActivePdfTab = usePdfTabStore((s) => s.setActivePdfTab)
  const closePdfTab = usePdfTabStore((s) => s.closePdfTab)
  const renamePdfTab = usePdfTabStore((s) => s.renamePdfTab)
  const addEmptyPdfTab = usePdfTabStore((s) => s.addEmptyPdfTab)
  const goToPdfHome = usePdfTabStore((s) => s.goToPdfHome)

  const activePdfTab = useMemo(() => {
    if (!activePdfTabId) return null
    return pdfTabs.find((tab) => tab.id === activePdfTabId) || null
  }, [pdfTabs, activePdfTabId])

  const pdfFile = useMemo(() => {
    return activePdfTab?.kind === 'drive' ? null : activePdfTab?.file || null
  }, [activePdfTab])

  const {
    recentReadingInfo,
    updateReadingProgress,
    upsertLastReadingInfo,
    flushPendingReadingProgress,
    clearLastReading,
    restoreRecentReading,
    recentReadingInfoRef
  } = useReadingProgressPersistence()

  const { handleSelectPdf, resumeLastPdf } = usePdfOpenActions({
    openPdfInTab: usePdfTabStore((s) => s.openPdfInTab),
    upsertLastReadingInfo,
    flushPendingReadingProgress,
    recentReadingInfoRef
  })

  const readingHistoryRef = useRef(recentReadingInfo)
  readingHistoryRef.current = recentReadingInfo

  const activeTabInitialPage = useMemo(() => {
    if (!activePdfTabId) return undefined
    if (activePdfTab?.kind !== 'pdf' || !activePdfTab?.file) return undefined
    const file = activePdfTab.file
    if (file.path) {
      const existing = (readingHistoryRef.current || []).find((entry) => entry.path === file.path)
      return existing?.page
    }
    return undefined
  }, [activePdfTabId, activePdfTab])

  const lastReadingInfoRef = readingHistoryRef

  const handleResumePdf = useCallback(
    async (path?: string): Promise<ResumePdfResult> => {
      const current = lastReadingInfoRef.current
      const target = path ? current.find((entry) => entry.path === path) : current[0]
      if (target) return await resumeLastPdf(target.path)
      return await resumeLastPdf(path)
    },
    [resumeLastPdf, lastReadingInfoRef]
  )

  const handleClearResumePdf = useCallback(
    (path?: string) => clearLastReading(path),
    [clearLastReading]
  )

  const handleReadingProgressChange = useCallback(
    (update: ReadingProgressUpdate) => updateReadingProgress(update),
    [updateReadingProgress]
  )

  return (
    <>
      {pdfTabs.length > 0 && (
        <PdfTabStrip
          tabs={pdfTabs}
          activeTabId={activePdfTabId}
          onSetActiveTab={setActivePdfTab}
          onCloseTab={closePdfTab}
          onRenameTab={renamePdfTab}
          onAddTab={addEmptyPdfTab || handleSelectPdf}
          onHome={goToPdfHome}
        />
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ErrorBoundary title={t('error_pdf_viewer')}>
          <PdfViewer
            pdfFile={pdfFile}
            activePdfTab={activePdfTab}
            onSelectPdf={handleSelectPdf}
            onTextSelection={handleTextSelection}
            t={t}
            initialPage={activeTabInitialPage}
            onResumePdf={handleResumePdf}
            onClearResumePdf={handleClearResumePdf}
            onRestoreResumePdf={restoreRecentReading}
            onReadingProgressChange={handleReadingProgressChange}
            lastReadingInfo={recentReadingInfo}
            isInteractionBlocked={false}
            isPanelResizing={false}
          />
        </ErrorBoundary>
      </div>
    </>
  )
})

export default FocusPdfBody
