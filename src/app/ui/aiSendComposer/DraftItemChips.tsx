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
 * kalır: şerit kendi satırında yatay akar.
 *
 * ## Hiyerarşi
 *
 * Her chip üç bilgiyi ayrı ayrı okunur biçimde taşır:
 *   `1 · Metin · 13/59  ×`
 * - **Sıra numarası**: öğenin gerçek eklenme sırası. Karışık metin/görsel
 *   kuyruklarında "hangi içerik ne?" sorusunu tek bakışta yanıtlar.
 * - **Tür**: metin mi görsel mi (ikon + etiket; yalnız ikon renk körlüğünde
 *   ayırt edilemez).
 * - **Kaynak sayfa**: `13/59` gibi `sayfa/toplam`; toplam bilinmiyorsa yalnızca
 *   sayfa. Çok sayfalı seçimde `11–13/59` aralığı korunur.
 *
 * Uzun belge adları satırı bozmaz: `WithTooltip` ile üzerine gelindiğinde/odak
 * alındığında tam ad okunur, ayrıca `sr-only` ile ekran okuyucuya da verilir.
 */
function DraftItemChips({ items, onRemoveItem }: DraftItemChipsProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <p
        className="border-border/40 bg-muted/15 text-ql-11 text-muted-foreground/75 mx-3 mt-2.5 mb-0.5 truncate rounded-lg border border-dashed px-3 py-1.5 text-center"
        data-testid="ai-draft-empty"
      >
        {t('ai_draft_empty_hint')}
      </p>
    )
  }

  return (
    <div className="custom-scrollbar scrollbar-hidden overflow-x-auto overflow-y-hidden px-3 pt-2.5 pb-0.5">
      <ul className="flex w-max items-center gap-1.5" aria-label={t('ai_send_panel_title')}>
        {items.map((item, index) => (
          <DraftItemChip key={item.id} item={item} order={index + 1} onRemove={onRemoveItem} />
        ))}
      </ul>
    </div>
  )
}

/** Tek chip: "1 · Metin · 13/59" + kaldırma. Uzun ad yalnızca erişilebilir açıklamada. */
function DraftItemChip({
  item,
  order,
  onRemove
}: {
  item: AiDraftItem
  order: number
  onRemove?: (id: string) => void
}) {
  const { t } = useTranslation()

  const pageLabel = item.source
    ? formatSourcePages(item.source)
    : item.type === 'image' && item.page
      ? String(item.page)
      : null
  const kindLabel = item.type === 'text' ? t('ai_draft_item_text') : t('ai_draft_item_image')
  const docName = item.source?.docName

  // Sıra numarası görsel olarak da okunur; ekran okuyucuya ayrıca "1." diye
  // duyurulur (chip içindeki görsel sıra, metin olarak da tekrarlanmaz).
  const parts = [kindLabel, pageLabel ? t('ai_draft_page_of', { page: pageLabel }) : null]
  const accessibleName = [t('ai_draft_item_position', { index: order }), ...parts]
    .filter(Boolean)
    .join(', ')

  const tooltipLabel = docName ? `${accessibleName} · ${docName}` : accessibleName

  return (
    <li
      className="border-border/50 bg-muted/35 focus-within:border-border hover:border-border/80 hover:bg-muted/65 motion-normal flex h-7 shrink-0 items-center gap-1.5 rounded-lg border pr-1 pl-1.5 transition-all"
      data-testid="ai-draft-item"
      title={tooltipLabel}
    >
      <span
        className="bg-background/80 text-muted-foreground text-ql-10 flex size-4 shrink-0 items-center justify-center rounded-md font-semibold tabular-nums"
        aria-hidden
      >
        {order}
      </span>
      <span
        style={{ color: 'var(--selection-color-source, oklch(var(--primary)))' }}
        className="text-primary flex size-3.5 shrink-0 items-center justify-center"
        aria-hidden
      >
        {item.type === 'text' ? <Type className="size-3.5" /> : <ImageIcon className="size-3.5" />}
      </span>
      <span className="text-ql-11 text-foreground shrink-0 font-medium">{kindLabel}</span>
      {pageLabel && (
        <span className="text-muted-foreground/85 text-ql-10 shrink-0 font-mono tabular-nums">
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
          aria-label={`${t('ai_send_remove_item')} — ${accessibleName}`}
          className={cn(
            'text-muted-foreground/75 hover:bg-destructive/12 hover:text-destructive size-5 shrink-0 rounded-md'
          )}
        >
          <X className="size-3" aria-hidden />
        </IconButton>
      )}
    </li>
  )
}

export default memo(DraftItemChips)
