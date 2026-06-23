import type { Plugin } from '@react-pdf-viewer/core'
import {
  type DocumentLoadEvent,
  type LoadError,
  type PdfJs,
  ScrollMode,
  SpecialZoomLevel,
  Viewer,
  ViewMode
} from '@react-pdf-viewer/core'
import { memo, useCallback, useEffect, useRef } from 'react'

interface PdfViewerElementProps {
  pdfUrl: string
  viewerReloadKey: number
  plugins: Plugin[]
  onPageChange: (e: { currentPage: number }) => void
  onDocumentLoad: (e: DocumentLoadEvent) => void
  onZoom: (e: { scale: number }) => void
  t: (key: string) => string
  tt: (key: string) => string
}

/**
 * Sabit referans — bileşen yeniden render edilse bile aynı fonksiyon
 * nesnesi kalır. Böylece <Viewer>'ın transformGetDocumentParams prop'u
 * her render'da değişmez ve PDF işleyicisi gereksiz yere yeniden
 * başlatılmaz/doküman tekrar yüklenmez.
 */
const transformDocParams = (params: PdfJs.GetDocumentParams) => ({
  ...params,
  isEvalSupported: false
})

function PdfViewerElement({
  pdfUrl,
  viewerReloadKey,
  plugins,
  onPageChange,
  onDocumentLoad,
  onZoom,
  t,
  tt
}: PdfViewerElementProps) {
  const isMountedRef = useRef(true)
  const onPageChangeRef = useRef(onPageChange)
  const onDocumentLoadRef = useRef(onDocumentLoad)
  const onZoomRef = useRef(onZoom)

  // Keep refs current so useCallback closures always call the latest handler
  onPageChangeRef.current = onPageChange
  onDocumentLoadRef.current = onDocumentLoad
  onZoomRef.current = onZoom

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Stable callbacks — prevent Viewer from re-subscribing on every render
  const safePageChange = useCallback((e: { currentPage: number }) => {
    if (!isMountedRef.current) return
    onPageChangeRef.current(e)
  }, [])

  const safeDocumentLoad = useCallback((e: DocumentLoadEvent) => {
    if (!isMountedRef.current) return
    onDocumentLoadRef.current(e)
  }, [])

  const safeZoom = useCallback((e: { scale: number }) => {
    if (!isMountedRef.current) return
    onZoomRef.current(e)
  }, [])

  const loader = (
    <div
      data-pdf-page-loader
      className="flex h-full min-h-[12rem] w-full items-center justify-center bg-transparent"
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500/25 border-t-amber-500 will-change-transform"
        role="status"
        aria-label={tt('loading')}
      />
    </div>
  )

  const renderError = (error: LoadError) => (
    <div className="flex h-full items-center justify-center bg-stone-950/50 p-8 text-center text-red-500 backdrop-blur-sm">
      <p>
        {t('pdf_load_error')}: {error.message || t('error_unknown_error')}
      </p>
    </div>
  )

  return (
    <div className="pdf-canvas-container">
      <Viewer
        key={`${pdfUrl}:${viewerReloadKey}`}
        fileUrl={pdfUrl}
        plugins={plugins}
        defaultScale={SpecialZoomLevel.PageWidth}
        scrollMode={ScrollMode.Page}
        viewMode={ViewMode.SinglePage}
        onPageChange={safePageChange}
        onDocumentLoad={safeDocumentLoad}
        onZoom={safeZoom}
        transformGetDocumentParams={transformDocParams}
        renderLoader={() => loader}
        renderError={renderError}
        theme={{ theme: 'dark' }}
      />
    </div>
  )
}

export default memo(PdfViewerElement)
