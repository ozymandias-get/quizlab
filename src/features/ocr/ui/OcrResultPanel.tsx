import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { useClipboard } from '@shared/hooks/useClipboard'
import { cn } from '@shared/lib/uiUtils'

import { Check, Copy, Download, RefreshCw, X } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { OcrPageResult } from '../types'
import MarkdownRenderer from './MarkdownRenderer'

interface OcrResultPanelProps {
  result: OcrPageResult | null
  status: string
  error: string | null
  pageNumber: number | null
  onClose: () => void
  onRetry: () => void
  onCopyPlainText?: () => void
}

// Lightweight tabs
type Tab = 'rendered' | 'markdown'

function OcrResultPanel({
  result,
  status,
  error,
  pageNumber,
  onClose,
  onRetry
}: OcrResultPanelProps) {
  const { t } = useTranslation()
  const { copy } = useClipboard()
  const [tab, setTab] = useState<Tab>('rendered')
  const [copied, setCopied] = useState<'md' | 'txt' | null>(null)

  const isLoading =
    status === 'rendering-page' || status === 'initializing-engine' || status === 'processing'
  const isError = status === 'error'

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
    // Integrate with existing AI draft queue if available via window dispatch
    // Fallback: copy to clipboard and toast
    await copy(result.markdown)
  }, [copy, result?.markdown])

  // Status label
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
    <div
      role="complementary"
      aria-label={t('ocr_result_panel', { defaultValue: 'OCR Result' })}
      className={cn(
        'border-border bg-popover/95 supports-[backdrop-filter]:bg-popover/80 flex max-h-[52vh] min-h-[280px] w-full flex-col overflow-hidden rounded-t-xl border shadow-lg backdrop-blur-xl',
        'dark:border-white/10',
        'animate-in slide-in-from-bottom-2 duration-200'
      )}
      data-testid="ocr-result-panel"
    >
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-ql-13 font-semibold tracking-tight">
            {t('ocr_panel_title', { defaultValue: 'OCR Result' })}
            {pageNumber ? (
              <span className="text-muted-foreground ml-1.5 font-normal">— p. {pageNumber}</span>
            ) : null}
          </h3>
          {isLoading && (
            <span className="text-ql-11 rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">
              {statusLabel}
            </span>
          )}
          {!isLoading && status === 'success' && result && (
            <span className="text-ql-11 rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
              {result.isNativeText
                ? t('ocr_badge_native', { defaultValue: 'Native text' })
                : t('ocr_badge_ocr', { defaultValue: 'OCR' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Copy markdown */}
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

          <IconButton
            variant="ghost"
            size="compact"
            onClick={onClose}
            aria-label={t('close', { defaultValue: 'Close' })}
            className="text-muted-foreground"
            data-testid="ocr-close-button"
          >
            <X className="size-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Tab strip */}
      <div className="border-border flex items-center gap-1 border-b px-2 py-1.5">
        <Button
          type="button"
          variant={tab === 'rendered' ? 'secondary' : 'ghost'}
          size="xs"
          onClick={() => setTab('rendered')}
          className="h-7 px-2.5"
          aria-selected={tab === 'rendered'}
          role="tab"
        >
          {t('ocr_tab_rendered', { defaultValue: 'Rendered' })}
        </Button>
        <Button
          type="button"
          variant={tab === 'markdown' ? 'secondary' : 'ghost'}
          size="xs"
          onClick={() => setTab('markdown')}
          className="h-7 px-2.5"
          aria-selected={tab === 'markdown'}
          role="tab"
        >
          {t('ocr_tab_markdown', { defaultValue: 'Markdown' })}
        </Button>

        {result?.plainText && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopyPlain}
            className="text-muted-foreground ml-auto h-7 gap-1 px-2"
          >
            {copied === 'txt' ? <Check className="size-3" /> : <Copy className="size-3" />}
            {t('ocr_copy_plain', { defaultValue: 'Copy plain text' })}
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <div
              className="border-primary/30 border-t-primary size-6 animate-spin rounded-full border-2"
              aria-hidden="true"
            />
            <p className="text-ql-13 text-muted-foreground">{statusLabel}</p>
            <p className="text-ql-11 text-muted-foreground/70">
              {pageNumber
                ? t('ocr_processing_page', {
                    defaultValue: 'Processing page {{page}}…',
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
          <MarkdownRenderer markdown={result.markdown} className="text-sm" />
        )}

        {!isLoading && !isError && result && tab === 'markdown' && (
          <pre className="bg-muted/40 border-border text-foreground overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
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
        <div className="border-border bg-muted/20 flex items-center gap-3 border-t px-3 py-1.5">
          <span className="text-ql-11 text-muted-foreground">
            {t('ocr_meta_engine', { defaultValue: 'Engine: {{engine}}', engine: result.engine })} ·{' '}
            {result.blocks.length} blocks
            {result.tables.length > 0 ? ` · ${result.tables.length} tables` : ''}
            {result.formulas.length > 0 ? ` · ${result.formulas.length} formulas` : ''}
          </span>
          <span className="text-ql-11 text-muted-foreground/60 ml-auto hidden sm:inline">
            {new Date(result.createdAt).toLocaleString()}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleSendToAi}
            className="text-ql-11 h-6 gap-1 px-2"
          >
            <Copy className="size-3" />
            {t('ocr_send_to_ai', { defaultValue: 'Copy for AI' })}
          </Button>
        </div>
      )}
    </div>
  )
}

export default memo(OcrResultPanel)
