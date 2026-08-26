import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { useClipboard } from '@shared/hooks/useClipboard'
import { cn } from '@shared/lib/uiUtils'
import { useToastActions } from '@shared/stores/toastStore'

import {
  Check,
  Copy,
  Download,
  GripHorizontal,
  Maximize2,
  Minimize2,
  RefreshCw,
  ScanSearch,
  Send,
  X
} from 'lucide-react'
import { motion, useDragControls } from 'motion/react'
import { memo, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { OcrPageResult } from '../types'
import MarkdownRenderer from './MarkdownRenderer'

interface OcrResultPanelProps {
  result: OcrPageResult | null
  status: string
  error: string | null
  pageNumber: number | null
  viewerPage?: number | null
  onClose: () => void
  onRetry: () => void
  onRunCurrent?: () => void
  onSendToAi?: (text: string) => void
}

type Tab = 'rendered' | 'markdown'

function OcrResultPanel({
  result,
  status,
  error,
  pageNumber,
  viewerPage,
  onClose,
  onRetry,
  onRunCurrent,
  onSendToAi
}: OcrResultPanelProps) {
  const { t } = useTranslation()
  const { copy } = useClipboard()
  const { showSuccess, showError } = useToastActions()
  const [tab, setTab] = useState<Tab>('rendered')
  const [copied, setCopied] = useState<'md' | 'txt' | null>(null)
  const [minimized, setMinimized] = useState(false)
  const dragControls = useDragControls()
  const [size, setSize] = useState({ width: 520, height: 520 })
  const resizingRef = useRef(false)
  const startSizeRef = useRef({ w: 520, h: 520, x: 0, y: 0 })

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizingRef.current = true
      startSizeRef.current = {
        w: size.width,
        h: size.height,
        x: e.clientX,
        y: e.clientY
      }
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        if (!resizingRef.current) return
        const dx = ev.clientX - startSizeRef.current.x
        const dy = ev.clientY - startSizeRef.current.y
        const nextW = Math.min(
          Math.max(320, startSizeRef.current.w + dx),
          Math.min(720, window.innerWidth - 32)
        )
        const nextH = Math.min(
          Math.max(300, startSizeRef.current.h + dy),
          Math.min(760, window.innerHeight - 80)
        )
        setSize({ width: nextW, height: nextH })
      }
      const onUp = () => {
        resizingRef.current = false
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp, { once: true })
    },
    [size.height, size.width]
  )

  const isLoading =
    status === 'rendering-page' || status === 'initializing-engine' || status === 'processing'
  const isError = status === 'error'
  const isStale = result && pageNumber != null && viewerPage != null && pageNumber !== viewerPage

  const handleCopyMarkdown = useCallback(async () => {
    if (!result?.markdown) return
    const ok = await copy(result.markdown)
    if (ok) {
      setCopied('md')
      setTimeout(() => setCopied(null), 1500)
    }
  }, [copy, result?.markdown])

  const handleCopyPlain = useCallback(async () => {
    if (!result?.plainText) return
    const ok = await copy(result.plainText)
    if (ok) {
      setCopied('txt')
      setTimeout(() => setCopied(null), 1500)
    }
  }, [copy, result?.plainText])

  const handleSave = useCallback(() => {
    if (!result?.markdown) return
    const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `page-${result.pageNumber}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [result])

  const handleSendToAi = useCallback(async () => {
    if (!result?.markdown) return
    try {
      if (onSendToAi) {
        onSendToAi(result.markdown)
        showSuccess(t('pdf_text_added_to_ai', { defaultValue: 'Text added to AI draft' }))
      } else {
        // Fallback: copy when no AI handler provided (e.g., in tests)
        await copy(result.markdown)
        showSuccess(t('pdf_text_added_to_ai', { defaultValue: 'Text added to AI draft' }))
      }
      // Also copy to clipboard as convenience
      await copy(result.markdown).catch(() => {})
    } catch {
      const ok = await copy(result.markdown)
      if (!ok) showError(t('toast_clipboard_failed', { defaultValue: 'Copy failed' }))
      else showSuccess(t('pdf_text_added_to_ai', { defaultValue: 'Text added to AI draft' }))
    }
  }, [copy, onSendToAi, result?.markdown, showError, showSuccess, t])

  const statusLabel = (() => {
    switch (status) {
      case 'rendering-page':
        return t('ocr_status_rendering', { defaultValue: 'Preparing page…' })
      case 'initializing-engine':
        return t('ocr_status_initializing', { defaultValue: 'Initializing engine…' })
      case 'processing':
        return t('ocr_status_processing', { defaultValue: 'Analyzing content…' })
      case 'success':
        return t('ocr_status_done', { defaultValue: 'Completed' })
      case 'error':
        return t('ocr_status_error', { defaultValue: 'Error' })
      case 'cancelled':
        return t('ocr_status_cancelled', { defaultValue: 'Cancelled' })
      default:
        return ''
    }
  })()

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.08}
      initial={{ y: 20, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 12, opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.9 }}
      role="complementary"
      aria-label={t('ocr_result_panel', { defaultValue: 'OCR Result' })}
      className={cn(
        'border-border bg-popover/98 supports-[backdrop-filter]:bg-popover/95 relative flex flex-col overflow-hidden rounded-2xl border shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)] backdrop-blur-2xl',
        'dark:border-white/10 dark:shadow-black/40',
        minimized ? 'min-h-0' : 'min-h-[320px]'
      )}
      data-testid="ocr-result-panel"
      style={{
        width: minimized ? 340 : size.width,
        height: minimized ? 52 : size.height,
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: minimized ? 52 : 'calc(100vh - 80px)',
        willChange: 'transform'
      }}
    >
      {/* Drag header */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className={cn(
          'border-border flex shrink-0 cursor-grab items-center justify-between border-b px-3 py-2 select-none active:cursor-grabbing',
          minimized && 'border-b-0'
        )}
        aria-label={t('ocr_drag_hint', { defaultValue: 'Drag header to move' })}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripHorizontal
            className="text-muted-foreground/60 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <h3 className="text-ql-13 flex items-center gap-1.5 font-semibold tracking-tight">
            <ScanSearch className="text-primary size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t('ocr_panel_title', { defaultValue: 'OCR Result' })}</span>
            {pageNumber ? (
              <span className="text-muted-foreground hidden font-mono text-xs font-normal sm:inline">
                — p. {pageNumber}
              </span>
            ) : null}
          </h3>
          {isLoading && (
            <span className="text-ql-11 rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">
              {statusLabel}
            </span>
          )}
          {!isLoading && status === 'success' && result && (
            <span
              className={cn(
                'text-ql-11 hidden rounded-full px-2 py-0.5 font-medium sm:inline-flex',
                result.isNativeText
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
              )}
            >
              {result.isNativeText
                ? t('ocr_badge_native', { defaultValue: 'Native text' })
                : t('ocr_badge_ocr', { defaultValue: 'OCR' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <WithTooltip
            label={
              minimized
                ? t('ocr_expand', { defaultValue: 'Expand' })
                : t('ocr_minimize', { defaultValue: 'Minimize' })
            }
          >
            <IconButton
              variant="ghost"
              size="compact"
              onClick={() => setMinimized((v) => !v)}
              aria-label={minimized ? t('ocr_expand') : t('ocr_minimize')}
              className="text-muted-foreground size-7"
            >
              {minimized ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
            </IconButton>
          </WithTooltip>
          <IconButton
            variant="ghost"
            size="compact"
            onClick={onClose}
            aria-label={t('ocr_close', { defaultValue: 'Close' })}
            className="text-muted-foreground size-7"
            data-testid="ocr-close-button"
          >
            <X className="size-3.5" />
          </IconButton>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Action bar */}
          <div className="border-border bg-muted/30 flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
            <div className="flex items-center gap-1">
              <WithTooltip label={t('ocr_copy_markdown', { defaultValue: 'Copy Markdown' })}>
                <IconButton
                  variant="ghost"
                  size="compact"
                  onClick={handleCopyMarkdown}
                  disabled={!result?.markdown || isLoading}
                  aria-label={t('ocr_copy_markdown')}
                  className="text-muted-foreground"
                >
                  {copied === 'md' ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </IconButton>
              </WithTooltip>
              <WithTooltip label={t('ocr_save_md', { defaultValue: 'Save as .md' })}>
                <IconButton
                  variant="ghost"
                  size="compact"
                  onClick={handleSave}
                  disabled={!result?.markdown || isLoading}
                  aria-label={t('ocr_save_md')}
                  className="text-muted-foreground"
                >
                  <Download className="size-3.5" />
                </IconButton>
              </WithTooltip>
              <WithTooltip label={t('ocr_retry', { defaultValue: 'Retry' })}>
                <IconButton
                  variant="ghost"
                  size="compact"
                  onClick={onRetry}
                  disabled={isLoading}
                  aria-label={t('ocr_retry')}
                  className="text-muted-foreground"
                >
                  <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
                </IconButton>
              </WithTooltip>
            </div>

            <div className="bg-border mx-1 hidden h-4 w-px sm:block" aria-hidden="true" />

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={tab === 'rendered' ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => setTab('rendered')}
                className="h-7 px-2.5 text-xs"
                aria-selected={tab === 'rendered'}
                role="tab"
              >
                {t('ocr_tab_rendered', { defaultValue: 'Preview' })}
              </Button>
              <Button
                type="button"
                variant={tab === 'markdown' ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => setTab('markdown')}
                className="h-7 px-2.5 text-xs"
                aria-selected={tab === 'markdown'}
                role="tab"
              >
                {t('ocr_tab_markdown', { defaultValue: 'Markdown' })}
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-1">
              {result?.plainText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleCopyPlain}
                  className="text-muted-foreground h-7 gap-1 px-2 text-xs"
                >
                  {copied === 'txt' ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {t('ocr_copy_plain', { defaultValue: 'Copy plain text' })}
                </Button>
              )}
            </div>
          </div>

          {/* Stale banner */}
          {isStale && (
            <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <ScanSearch className="size-3 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-ql-12 flex-1 leading-snug text-amber-800 dark:text-amber-200">
                {t('ocr_stale_notice', {
                  defaultValue: 'Result is for page {page} — you are viewing page {current}.',
                  page: pageNumber,
                  current: viewerPage
                })}
              </p>
              {onRunCurrent && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={onRunCurrent}
                  className="h-6 shrink-0 border-amber-500/30 bg-white/60 text-xs text-amber-700 hover:bg-amber-500/10 dark:bg-amber-950/20 dark:text-amber-300"
                >
                  {t('ocr_run_this_page', { defaultValue: 'Run OCR for this page' })}
                </Button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="bg-background/50 flex-1 overflow-auto p-4">
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <div
                  className="border-primary/30 border-t-primary size-6 animate-spin rounded-full border-2"
                  aria-hidden="true"
                />
                <p className="text-ql-13 text-muted-foreground font-medium">{statusLabel}</p>
                <p className="text-ql-11 text-muted-foreground/70">
                  {pageNumber
                    ? t('ocr_processing_page', {
                        defaultValue: 'Processing page {page}…',
                        page: pageNumber
                      })
                    : null}
                </p>
              </div>
            )}

            {isError && !isLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <p className="text-ql-13 text-destructive font-medium">
                  {t(error || 'ocr_error_generic', { defaultValue: 'Something went wrong' })}
                </p>
                <p className="text-ql-11 text-muted-foreground max-w-sm">
                  {t('ocr_error_hint', {
                    defaultValue: 'Try again or use Force OCR from the panel menu.'
                  })}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="mt-2 gap-1.5"
                >
                  <RefreshCw className="size-3.5" />
                  {t('retry', { defaultValue: 'Retry' })}
                </Button>
              </div>
            )}

            {!isLoading && !isError && result && tab === 'rendered' && (
              <MarkdownRenderer markdown={result.markdown} className="text-sm leading-relaxed" />
            )}

            {!isLoading && !isError && result && tab === 'markdown' && (
              <pre className="bg-muted/40 border-border text-foreground overflow-auto rounded-xl border p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
                {result.markdown}
              </pre>
            )}

            {!isLoading && !isError && !result && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t('ocr_no_result', { defaultValue: 'No OCR result yet.' })}
              </p>
            )}
          </div>

          {/* Footer meta */}
          {result && !isLoading && (
            <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 border-t px-3 py-2">
              <span className="text-ql-11 text-muted-foreground inline-flex flex-wrap items-center gap-1.5">
                <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
                  {t('ocr_meta_engine', {
                    defaultValue: 'Engine: {engine}',
                    engine: result.engine
                  })}
                </span>
                <span>
                  {t('ocr_blocks', { defaultValue: '{count} blocks', count: result.blocks.length })}
                </span>
                {result.tables.length > 0 && (
                  <span>
                    {t('ocr_tables', {
                      defaultValue: '{count} tables',
                      count: result.tables.length
                    })}
                  </span>
                )}
                {result.formulas.length > 0 && (
                  <span>
                    {t('ocr_formulas', {
                      defaultValue: '{count} formulas',
                      count: result.formulas.length
                    })}
                  </span>
                )}
              </span>
              <span className="text-ql-11 text-muted-foreground/60 ml-auto hidden items-center gap-1.5 tabular-nums sm:inline-flex">
                {new Date(result.createdAt).toLocaleString()}
              </span>
              <Button
                type="button"
                variant="default"
                size="xs"
                onClick={handleSendToAi}
                className="text-ql-11 ml-auto h-7 gap-1.5 px-2.5 sm:ml-0"
              >
                <Send className="size-3" />
                {t('ocr_send_to_ai', { defaultValue: 'Copy for AI' })}
              </Button>
            </div>
          )}
        </>
      )}
      {/* Resize handle */}
      {!minimized && (
        <div
          onPointerDown={handleResizePointerDown}
          className="absolute right-0 bottom-0 flex size-6 cursor-nwse-resize items-center justify-center rounded-tl-lg bg-transparent opacity-60 hover:opacity-100"
          aria-label="Resize"
          role="separator"
        >
          <div className="bg-muted-foreground/40 h-3 w-3 rounded-[2px] opacity-40 [background:repeating-linear-gradient(-45deg,transparent_0_2px,currentColor_2px_3px)]" />
        </div>
      )}
    </motion.div>
  )
}

export default memo(OcrResultPanel)
