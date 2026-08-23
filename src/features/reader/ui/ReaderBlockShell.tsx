import type { QuizLabBlock } from '@shared-core/types'

import { useShowInPdf } from '@features/reader/hooks/useReaderPdfLink'

import { ExternalLink } from 'lucide-react'
import { memo } from 'react'

export function PageBadge({ pageNumber }: { pageNumber: number }) {
  return (
    <span
      className="text-ql-11 text-muted-foreground/70 border-border/60 bg-muted/30 inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono backdrop-blur"
      title={`Sayfa ${pageNumber}`}
      aria-label={`Sayfa ${pageNumber}`}
    >
      {pageNumber}
    </span>
  )
}

export const BlockWrapper = memo(function BlockWrapper({
  block,
  children
}: {
  block: QuizLabBlock
  children: React.ReactNode
}) {
  const showInPdf = useShowInPdf()
  return (
    <div
      data-block-id={block.id}
      data-page={block.pageNumber}
      className="group/block scroll-mt-4"
      style={{ contentVisibility: 'auto' as never, containIntrinsicSize: '0 600px' } as never}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex shrink-0 items-center gap-1 pt-1">
          <PageBadge pageNumber={block.pageNumber} />
          <button
            type="button"
            onClick={() => showInPdf(block)}
            className="border-border/60 bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border hidden h-6 w-6 items-center justify-center rounded-md border opacity-0 backdrop-blur transition-all group-hover/block:opacity-100 md:inline-flex"
            aria-label={`PDF'de göster, sayfa ${block.pageNumber}`}
            title="PDF'de göster"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
})
