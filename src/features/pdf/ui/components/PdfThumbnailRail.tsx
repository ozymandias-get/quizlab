import type { NativePdfController } from '@features/pdf/native/useNativePdfController'

import { cn } from '@shared/lib/uiUtils'

import { FileText } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

/** Logical width the page is rasterised at; CSS scales it down to the rail. */
const THUMBNAIL_RENDER_WIDTH = 144

interface PdfThumbnailRailProps {
  controller: NativePdfController
  t: (key: string) => string
}

/**
 * Lazily rendered page thumbnail. The observer defers the PDF.js render until
 * the tile is actually near the viewport, so opening a 500-page document does
 * not start 500 renders at once.
 */
const PdfThumbnail = memo(function PdfThumbnail({
  pageNumber,
  isActive,
  renderPageThumbnail,
  onSelect,
  label
}: {
  pageNumber: number
  isActive: boolean
  renderPageThumbnail: NativePdfController['renderPageThumbnail']
  onSelect: (page: number) => void
  label: string
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    const node = buttonRef.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '160px 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const controller = new AbortController()
    void renderPageThumbnail(pageNumber, canvas, THUMBNAIL_RENDER_WIDTH, controller.signal)
      .then(() => {
        if (!cancelled) setHasRendered(true)
      })
      .catch(() => {
        if (!cancelled) setHasFailed(true)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isVisible, pageNumber, renderPageThumbnail])

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => onSelect(pageNumber)}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      data-testid={`pdf-thumbnail-${pageNumber}`}
      data-active={isActive ? 'true' : undefined}
      className={cn(
        'group focus-visible:ring-ring/70 motion-normal flex w-full shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none',
        isActive
          ? 'border-primary/50 bg-primary/10'
          : 'border-transparent hover:border-white/12 hover:bg-white/[0.04]'
      )}
    >
      <span
        className={cn(
          'relative flex w-full items-center justify-center overflow-hidden rounded-[4px] bg-zinc-900/60 shadow-xs',
          !hasRendered && 'min-h-[5.5rem]'
        )}
      >
        {!hasRendered && !hasFailed && (
          <span className="absolute inset-0 bg-zinc-800/60 motion-safe:animate-pulse" aria-hidden />
        )}
        {hasFailed ? (
          <FileText className="text-muted-foreground/60 my-6 size-5" aria-hidden />
        ) : (
          <canvas ref={canvasRef} className="block h-auto w-full" aria-hidden />
        )}
      </span>
      <span
        className={cn(
          'text-ql-10 tabular-nums transition-colors',
          isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
        )}
      >
        {pageNumber}
      </span>
    </button>
  )
})

const PdfThumbnailRail = memo(function PdfThumbnailRail({ controller, t }: PdfThumbnailRailProps) {
  const { totalPages, currentPage, jumpToPage, documentKey, renderPageThumbnail } = controller
  const listRef = useRef<HTMLDivElement>(null)

  const handleSelect = useCallback((page: number) => jumpToPage(page), [jumpToPage])

  // Keep the active page in view, whichever way the user navigated.
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [currentPage])

  return (
    <aside
      aria-label={t('pdf_thumbnails')}
      data-testid="pdf-thumbnail-rail"
      className="shadow-ambient-md absolute inset-y-0 left-0 z-20 flex w-[9.75rem] flex-col overflow-hidden border-r border-white/[0.07] bg-zinc-950/95"
    >
      <div
        ref={listRef}
        className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2"
      >
        {Array.from({ length: totalPages }, (_, index) => {
          const pageNumber = index + 1
          return (
            <PdfThumbnail
              key={`${documentKey}:${pageNumber}`}
              pageNumber={pageNumber}
              isActive={pageNumber === currentPage}
              renderPageThumbnail={renderPageThumbnail}
              onSelect={handleSelect}
              label={`${t('pdf_thumbnails')} ${pageNumber}`}
            />
          )
        })}
      </div>
    </aside>
  )
})

PdfThumbnailRail.displayName = 'PdfThumbnailRail'

export default PdfThumbnailRail
