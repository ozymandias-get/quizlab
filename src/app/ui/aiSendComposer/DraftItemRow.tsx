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
      className="group border-border/50 bg-muted/40 hover:border-border hover:bg-muted/70 focus-within:border-border flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors"
    >
      <span
        className="bg-background text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md"
        aria-hidden
      >
        {item.type === 'text' ? <Type className="size-3.5" /> : <ImageIcon className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-ql-12 truncate font-medium">{kindLabel}</span>
          {pageLabel && (
            <span className="text-muted-foreground text-ql-11 shrink-0 tabular-nums">
              · {pageLabel}
            </span>
          )}
        </span>
        {docName && (
          <span className="text-muted-foreground text-ql-11 block truncate">{docName}</span>
        )}
      </span>
      {onRemove && (
        <IconButton
          type="button"
          variant="ghost"
          size="compact"
          onClick={() => onRemove(item.id)}
          aria-label={t('ai_send_remove_item')}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 opacity-70 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-3.5" aria-hidden />
        </IconButton>
      )}
    </li>
  )
}

export default memo(DraftItemRow)
