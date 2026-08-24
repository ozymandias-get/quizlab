import type { QuizLabDocument } from '@shared-core/types'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { BlockRenderer } from './ReaderBlocks'

interface Props {
  document: QuizLabDocument
  onReprocess?: () => void
  onSwitchToPdf?: () => void
}

const ReaderView = memo(function ReaderView({ document, onReprocess, onSwitchToPdf }: Props) {
  const { t } = useTranslation()
  const meta = document.metadata as unknown as {
    partial?: boolean
    partialReason?: string
    degradedPipeline?: boolean
    degradedReason?: string
  }
  const isPartial = !!meta?.partial
  const isDegraded = !!meta?.degradedPipeline

  return (
    <article
      className="mx-auto max-w-[46rem] px-6 py-8 select-text md:px-8"
      aria-label={document.title ?? t('reader_smart_reading', { defaultValue: 'Akıllı okuma' })}
    >
      {isPartial && (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/10 text-destructive mb-6 rounded-xl border p-4"
        >
          <p className="text-ql-13 font-semibold">
            {t('reader_partial_warning_title', {
              defaultValue: 'Belgenin tamamı dönüştürülemedi.'
            })}
          </p>
          <p className="text-ql-12 mt-1">
            {t('reader_partial_warning_desc', {
              defaultValue: 'Bazı sayfalar zaman aşımı nedeniyle eksik olabilir.'
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onSwitchToPdf && (
              <button
                type="button"
                onClick={onSwitchToPdf}
                className="border-destructive/30 bg-card text-ql-12 rounded-lg border px-3 py-1.5"
              >
                {t('reader_partial_action_pdf', { defaultValue: "PDF'ye geç" })}
              </button>
            )}
            {onReprocess && (
              <button
                type="button"
                onClick={onReprocess}
                className="bg-destructive text-destructive-foreground text-ql-12 rounded-lg px-3 py-1.5"
              >
                {t('reader_partial_action_reprocess', { defaultValue: 'Yeniden işle' })}
              </button>
            )}
          </div>
        </div>
      )}
      {isDegraded && !isPartial && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200"
        >
          <p className="text-ql-12">
            {t('reader_degraded_warning', {
              defaultValue: 'Bazı gelişmiş analiz özellikleri kullanılamadı.'
            })}
          </p>
        </div>
      )}
      {(document.title || onReprocess) && (
        <header className="border-border/50 bg-card/40 mb-8 rounded-2xl border p-5 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {document.title ? (
                <h1 className="text-foreground text-[1.45rem] leading-7 font-bold tracking-tight">
                  {document.title}
                </h1>
              ) : (
                <p className="text-muted-foreground text-ql-13">
                  {t('reader_untitled', { defaultValue: 'Başlıksız belge' })}
                </p>
              )}
              <p className="text-muted-foreground/70 text-ql-11 mt-1.5 flex flex-wrap items-center gap-2 font-mono">
                <span>
                  {t('reader_page_count', {
                    count: document.pageCount,
                    defaultValue: '{{count}} sayfa'
                  })}
                </span>
                <span className="bg-border h-1 w-1 rounded-full" aria-hidden />
                <span>
                  {t('reader_block_count', {
                    count: document.blocks.length,
                    defaultValue: '{{count}} blok'
                  })}
                </span>
                {document.metadata?.conversionTimeMs != null && (
                  <>
                    <span className="bg-border h-1 w-1 rounded-full" aria-hidden />
                    <span>{(document.metadata.conversionTimeMs / 1000).toFixed(1)}s</span>
                  </>
                )}
              </p>
            </div>
            {onReprocess && (
              <button
                type="button"
                onClick={onReprocess}
                className="text-ql-11 border-border bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card shrink-0 rounded-full border px-3 py-1.5 backdrop-blur transition-colors"
                aria-label={t('reader_reprocess_aria', { defaultValue: 'Belgeyi yeniden işle' })}
              >
                {t('reader_reprocess', { defaultValue: 'Yeniden işle' })}
              </button>
            )}
          </div>
        </header>
      )}
      <div className="space-y-1">
        {document.blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} />
        ))}
      </div>
      {document.blocks.length === 0 && (
        <p className="text-muted-foreground text-ql-13 py-12 text-center">
          {t('reader_no_content', { defaultValue: 'İçerik bulunamadı' })}
        </p>
      )}
    </article>
  )
})

export default ReaderView
