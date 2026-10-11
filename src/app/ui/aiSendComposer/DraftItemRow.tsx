import { formatSourcePageLabel } from '@app/providers/ai/pdfSource'
import type { AiDraftItem } from '@app/providers/ai/types'
import { IconButton } from '@shared/ui/components/primitives'

import { Image as ImageIcon, Type, X } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

/** Tek içerik satırı: tür + sayfa bilgisi + kaldırma. Galeri/önizleme yok. */
function DraftItemRow({ item, onRemove }: { item: AiDraftItem; onRemove?: (id: string) => void }) {
  const { t } = useTranslation()
  const pageLabel = item.source
    ? formatSourcePageLabel(item.source)
    : item.type === 'image' && item.page
      ? `Sayfa ${item.page}`
      : null
  const kindLabel = item.type === 'text' ? t('ai_draft_item_text') : t('ai_draft_item_image')
  const docName = item.source?.docName

  return (
    <li
      key={item.id}
      data-testid="ai-draft-item"
      className="group border-border/55 bg-muted/30 hover:border-border hover:bg-muted/60 focus-within:border-border focus-within:bg-muted/60 flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors"
    >
      <span
        className="border-border/60 bg-background/80 text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md border"
        aria-hidden
      >
        {item.type === 'text' ? <Type className="size-3.5" /> : <ImageIcon className="size-3.5" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-ql-12 truncate font-medium">{kindLabel}</span>
          {pageLabel && (
            <span className="bg-background/70 text-muted-foreground ring-border/50 text-ql-10 shrink-0 rounded px-1 py-px font-medium tabular-nums ring-1 ring-inset">
              {pageLabel}
            </span>
          )}
        </span>
        {docName && <span className="text-muted-foreground/90 text-ql-11 truncate">{docName}</span>}
      </span>
      {onRemove && (
        <IconButton
          type="button"
          variant="ghost"
          size="compact"
          onClick={() => onRemove(item.id)}
          aria-label={t('ai_send_remove_item')}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 opacity-60 transition-colors group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-3.5" aria-hidden />
        </IconButton>
      )}
    </li>
  )
}

export default memo(DraftItemRow)
