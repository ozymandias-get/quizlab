import type { QuizLabBlock } from '@shared-core/types'

import { useShowInPdf } from '@features/reader/hooks/useReaderPdfLink'

import { ExternalLink, Send } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

function blockToMarkdown(block: QuizLabBlock): string {
  switch (block.type) {
    case 'heading': {
      const lvl = (block as { level: number }).level ?? 1
      return `${'#'.repeat(Math.min(6, lvl))} ${(block as { text: string }).text}`
    }
    case 'paragraph':
    case 'list_item':
    case 'caption':
      return (block as { text: string }).text
    case 'code':
      return '```\n' + (block as { text: string }).text + '\n```'
    case 'formula':
      return `$$${(block as { text: string }).text}$$`
    case 'table': {
      const rows = (block as { rows: { text: string }[][] }).rows
      if (rows.length === 0) return ''
      const header = `| ${rows[0].map((c) => c.text || ' ').join(' | ')} |`
      const sep = `| ${rows[0].map(() => '---').join(' | ')} |`
      const body = rows.slice(1).map((r) => `| ${r.map((c) => c.text || ' ').join(' | ')} |`)
      return [header, sep, ...body].join('\n')
    }
    case 'image':
      return (block as { alt: string | null }).alt ?? `[image ${block.pageNumber}]`
    default:
      return (block as unknown as { text?: string }).text ?? ''
  }
}

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
  const { t } = useTranslation()
  const sendToAi = useCallback(() => {
    const text = blockToMarkdown(block)
    if (!text.trim()) return
    // Dispatch a custom event that AiSendComposer listens to, or use the
    // global draft store if available. Fallback: copy to clipboard + toast.
    const evt = new CustomEvent('quizlab:send-block-to-ai', { detail: { text, blockId: block.id } })
    window.dispatchEvent(evt)
    // Fallback for web/electron: try to use the app-tool draft store if present
    try {
      const api = (window as unknown as { __quizlabAddDraft?: (t: string) => void })
        .__quizlabAddDraft
      if (api) api(text)
      else void navigator.clipboard.writeText(text).catch(() => {})
    } catch {}
  }, [block])
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
          <button
            type="button"
            onClick={sendToAi}
            className="border-border/60 bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border hidden h-6 w-6 items-center justify-center rounded-md border opacity-0 backdrop-blur transition-all group-hover/block:opacity-100 md:inline-flex"
            aria-label={t('reader_send_to_ai', { defaultValue: 'AI’a gönder' })}
            title={t('reader_send_to_ai', { defaultValue: 'AI’a gönder' })}
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
})
