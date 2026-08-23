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
      className="mx-auto max-w-3xl px-6 py-8 select-text"
      aria-label={document.title ?? 'Akıllı okuma'}
    >
      {document.title && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="text-foreground text-xl font-bold tracking-tight">{document.title}</h1>
          {onReprocess && (
            <button
              type="button"
              onClick={onReprocess}
              className="text-ql-11 border-border bg-card text-muted-foreground hover:text-foreground shrink-0 rounded-full border px-2.5 py-1"
              aria-label="Belgeyi yeniden işle"
            >
              Yeniden işle
            </button>
          )}
        </div>
      )}
      {!document.title && onReprocess && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onReprocess}
            className="text-ql-11 border-border bg-card text-muted-foreground hover:text-foreground rounded-full border px-2.5 py-1"
          >
            Yeniden işle
          </button>
        </div>
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
