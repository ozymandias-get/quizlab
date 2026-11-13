import { formatSourcePages } from '@app/providers/ai/pdfSource'
import type { AiDraftItem } from '@app/providers/ai/types'
import { cn } from '@shared/lib/uiUtils'
import { IconButton, WithTooltip } from '@shared/ui/components/primitives'

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
        className="text-ql-11 text-muted-foreground mx-3 mt-2.5 mb-0.5 truncate rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-3 py-1.5 text-center"
        data-testid="ai-draft-empty"
      >
        {t('ai_draft_empty_hint')}
      </p>
    )
  }

  return (
    <div className="custom-scrollbar scrollbar-hidden overflow-x-auto overflow-y-hidden px-3 pt-2.5 pb-0.5">
      <ul className="flex w-max items-center gap-2" aria-label={t('ai_send_panel_title')}>
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
    <WithTooltip
      label={tooltipLabel}
      contentClassName="max-w-[min(22rem,80vw)] whitespace-normal break-words"
    >
      <li
        className="group motion-normal flex h-8 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-zinc-800/90 pr-0.5 pl-2 transition-all focus-within:border-white/20 hover:border-white/20 hover:bg-zinc-800"
        data-testid="ai-draft-item"
      >
        <span
          className="text-muted-foreground text-ql-10 flex size-4 shrink-0 items-center justify-center rounded-md bg-zinc-950/80 font-semibold tabular-nums"
          aria-hidden
        >
          {order}
        </span>
        <span
          style={{ color: 'var(--selection-color-source, oklch(var(--primary)))' }}
          className="text-primary flex size-3.5 shrink-0 items-center justify-center"
          aria-hidden
        >
          {item.type === 'text' ? (
            <Type className="size-3.5" />
          ) : (
            <ImageIcon className="size-3.5" />
          )}
        </span>
        <span className="text-ql-11 text-foreground shrink-0 font-medium">{kindLabel}</span>
        {pageLabel && (
          <span className="text-muted-foreground text-ql-10 shrink-0 font-mono tabular-nums">
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
              // A 24px box with its own padding keeps the delete target away
              // from the label; a mis-click no longer costs the user the draft.
              'text-muted-foreground/70 hover:bg-destructive/12 hover:text-destructive ml-1 size-6 shrink-0 rounded-md p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100'
            )}
          >
            <X className="size-3" aria-hidden />
          </IconButton>
        )}
      </li>
    </WithTooltip>
  )
}

export default memo(DraftItemChips)
