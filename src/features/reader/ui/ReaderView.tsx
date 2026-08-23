import type { QuizLabDocument } from '@shared-core/types'

import { memo } from 'react'

import { BlockRenderer } from './ReaderBlocks'

interface Props {
  document: QuizLabDocument
  onReprocess?: () => void
}

const ReaderView = memo(function ReaderView({ document, onReprocess }: Props) {
  return (
    <article
      className="mx-auto max-w-[46rem] px-6 py-8 select-text md:px-8"
      aria-label={document.title ?? 'Akıllı okuma'}
    >
      {(document.title || onReprocess) && (
        <header className="border-border/50 bg-card/40 mb-8 rounded-2xl border p-5 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {document.title ? (
                <h1 className="text-foreground text-[1.45rem] leading-7 font-bold tracking-tight">
                  {document.title}
                </h1>
              ) : (
                <p className="text-muted-foreground text-ql-13">Başlıksız belge</p>
              )}
              <p className="text-muted-foreground/70 text-ql-11 mt-1.5 flex flex-wrap items-center gap-2 font-mono">
                <span>{document.pageCount} sayfa</span>
                <span className="bg-border h-1 w-1 rounded-full" aria-hidden />
                <span>{document.blocks.length} blok</span>
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
                aria-label="Belgeyi yeniden işle"
              >
                Yeniden işle
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
        <p className="text-muted-foreground text-ql-13 py-12 text-center">İçerik bulunamadı</p>
      )}
    </article>
  )
})

export default ReaderView
