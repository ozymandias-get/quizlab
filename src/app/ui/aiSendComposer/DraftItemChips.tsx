import { formatSourcePages } from '@app/providers/ai/pdfSource'
import type { AiDraftItem } from '@app/providers/ai/types'
import { cn } from '@shared/lib/uiUtils'
import { IconButton } from '@shared/ui/components/primitives'

import { Image as ImageIcon, Type, X } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface DraftItemChipsProps {
  items: AiDraftItem[]
  onRemoveItem?: (id: string) => void
}

/**
 * Taslak içerikleri — yatay kaydırılabilen kompakt chip şeridi.
 *
 * Görsel önizleme/galeri yok, base64 yok; yalnızca tür + kaynak sayfa. Uzun PDF
 * adı satırı bozmaz (tooltip'te taşınır). 10–20 öğede dock yüksekliği sabit
 * kalır: şerit kendi satırında yatay akar. Öğeler gerçek kuyruk sırasını korur
 * ve her biri tek tek kaldırılabilir.
 */
function DraftItemChips({ items, onRemoveItem }: DraftItemChipsProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <p
        className="text-ql-11 text-muted-foreground/80 truncate px-3 pt-2 pb-1"
        data-testid="ai-draft-empty"
      >
        {t('ai_draft_empty_hint')}
      </p>
    )
  }

  return (
    <div className="custom-scrollbar scrollbar-hidden overflow-x-auto overflow-y-hidden px-3 pt-2 pb-1">
      <ul className="flex w-max items-center gap-1.5" aria-label={t('ai_send_panel_title')}>
        {items.map((item) => (
          <DraftItemChip key={item.id} item={item} onRemove={onRemoveItem} />
        ))}
      </ul>
    </div>
  )
}

/** Tek chip: "Metin · 13/59" + kaldırma. Uzun ad yalnızca erişilebilir açıklamada. */
function DraftItemChip({ item, onRemove }: { item: AiDraftItem; onRemove?: (id: string) => void }) {
  const { t } = useTranslation()

  const pageLabel = item.source
    ? formatSourcePages(item.source)
    : item.type === 'image' && item.page
      ? String(item.page)
      : null
  const kindLabel = item.type === 'text' ? t('ai_draft_item_text') : t('ai_draft_item_image')
  const docName = item.source?.docName

  const accessibleName = docName
    ? `${kindLabel}${pageLabel ? `, ${t('ai_draft_page_of', { page: pageLabel })}` : ''}. ${docName}`
    : `${kindLabel}${pageLabel ? `, ${t('ai_draft_page_of', { page: pageLabel })}` : ''}`

  return (
    <li
      data-testid="ai-draft-item"
      title={docName ?? undefined}
      className="border-border/60 bg-muted/40 focus-within:border-border hover:border-ring/30 hover:bg-muted/70 motion-normal flex h-7 shrink-0 items-center gap-1.5 rounded-full border pr-1 pl-2 transition-colors"
    >
      <span
        className="text-muted-foreground flex size-3.5 shrink-0 items-center justify-center"
        aria-hidden
      >
        {item.type === 'text' ? <Type className="size-3.5" /> : <ImageIcon className="size-3.5" />}
      </span>
      <span className="text-ql-11 shrink-0 font-medium">{kindLabel}</span>
      {pageLabel && (
        <span className="text-muted-foreground text-ql-10 shrink-0 tabular-nums">
          · {pageLabel}
        </span>
      )}
      <span className="sr-only">{accessibleName}</span>
      {onRemove && (
        <IconButton
          type="button"
          variant="ghost"
          size="compact"
          onClick={() => onRemove(item.id)}
          aria-label={t('ai_send_remove_item')}
          className={cn(
            'text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-5 shrink-0 rounded-full'
          )}
        >
          <X className="size-3" aria-hidden />
        </IconButton>
      )}
    </li>
  )
}

export default memo(DraftItemChips)
