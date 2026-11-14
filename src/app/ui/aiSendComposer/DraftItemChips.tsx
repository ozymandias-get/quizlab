import { formatSourcePages } from '@app/providers/ai/pdfSource'
import type { AiDraftItem } from '@app/providers/ai/types'
import { cn } from '@shared/lib/uiUtils'
import { IconButton, WithTooltip } from '@shared/ui/components/primitives'

import { Image as ImageIcon, Type, X } from 'lucide-react'
import { memo, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface DraftItemChipsProps {
  items: AiDraftItem[]
  onRemoveItem?: (id: string) => void
  /** Gönderim sürerken kuyruğu değiştirmeyi kapatır (snapshot zaten alınmıştır). */
  disabled?: boolean
}

/**
 * Taslak içerikleri — yatay kaydırılabilen kompakt chip şeridi + isteğe bağlı
 * tek öğe önizlemesi.
 *
 * Varsayılan görünüm değişmedi: tür + sıra + kaynak sayfa. Bir chip'e
 * tıklamak (veya Enter/Space) **yalnızca o öğenin** hafif önizlemesini açar;
 * aynı anda tek önizleme vardır ve varsayılan olarak kapalıdır. Görsel
 * önizlemesi yalnızca kuyruğun zaten ürettiği `blobUrl`'i kullanır — base64
 * dönüşümü, yeniden encode veya yeni bir kopya yoktur. Kaynak hazır değilse
 * metin yer tutucu gösterilir.
 */
function DraftItemChips({ items, onRemoveItem, disabled = false }: DraftItemChipsProps) {
  const { t } = useTranslation()
  const [previewId, setPreviewId] = useState<string | null>(null)
  const previewPanelId = useId()
  const previewItem = items.find((item) => item.id === previewId) ?? null

  if (items.length === 0) {
    return (
      <p
        className="text-ql-11 text-muted-foreground mx-3 mt-2.5 mb-0.5 truncate rounded-lg border border-dashed border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-center"
        data-testid="ai-draft-empty"
      >
        {t('ai_draft_empty_hint')}
      </p>
    )
  }

  return (
    <div>
      <div className="custom-scrollbar scrollbar-hidden overflow-x-auto overflow-y-hidden px-3 pt-2.5 pb-0.5">
        <ul className="flex w-max items-center gap-2" aria-label={t('ai_send_panel_title')}>
          {items.map((item, index) => (
            <DraftItemChip
              key={item.id}
              item={item}
              order={index + 1}
              onRemove={disabled ? undefined : onRemoveItem}
              isPreviewOpen={previewId === item.id}
              previewControlsId={previewPanelId}
              onTogglePreview={() =>
                setPreviewId((current) => (current === item.id ? null : item.id))
              }
            />
          ))}
        </ul>
      </div>

      {previewItem && <DraftItemPreview id={previewPanelId} item={previewItem} />}
    </div>
  )
}

/** Tek chip: "1 · Metin · 13/59" + önizleme + kaldırma. */
function DraftItemChip({
  item,
  order,
  onRemove,
  isPreviewOpen,
  previewControlsId,
  onTogglePreview
}: {
  item: AiDraftItem
  order: number
  onRemove?: (id: string) => void
  isPreviewOpen: boolean
  previewControlsId: string
  onTogglePreview: () => void
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
  const previewLabel = t(isPreviewOpen ? 'ai_draft_preview_hide' : 'ai_draft_preview_show')

  return (
    <WithTooltip
      label={tooltipLabel}
      contentClassName="max-w-[min(22rem,80vw)] whitespace-normal break-words"
    >
      <li
        className={cn(
          'group motion-normal flex h-8 shrink-0 items-center gap-1 rounded-lg border bg-zinc-900/85 pr-0.5 pl-1 transition-all',
          isPreviewOpen
            ? 'border-white/20 bg-zinc-900'
            : 'border-white/[0.07] hover:border-white/20 hover:bg-zinc-900'
        )}
        data-testid="ai-draft-item"
      >
        <button
          type="button"
          onClick={onTogglePreview}
          aria-label={`${previewLabel} — ${accessibleName}`}
          aria-expanded={isPreviewOpen}
          aria-controls={isPreviewOpen ? previewControlsId : undefined}
          className="focus-visible:ring-ring/70 flex h-full min-w-0 cursor-pointer items-center gap-2 rounded-md pr-1 pl-1 text-left focus-visible:ring-1 focus-visible:outline-none"
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
        </button>
        {onRemove && (
          <IconButton
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => onRemove(item.id)}
            aria-label={`${t('ai_send_remove_item')} — ${accessibleName}`}
            className={cn(
              // A 24px box with its own padding keeps the delete target away
              // from the label; a mis-click no longer costs you the draft.
              'text-muted-foreground/70 hover:bg-destructive/12 hover:text-destructive size-6 shrink-0 rounded-md p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100'
            )}
          >
            <X className="size-3" aria-hidden />
          </IconButton>
        )}
      </li>
    </WithTooltip>
  )
}

/** Açık tek öğenin hafif önizlemesi: metin veya mevcut blob önizlemesi. */
function DraftItemPreview({ id, item }: { id: string; item: AiDraftItem }) {
  const { t } = useTranslation()
  const pageLabel = item.source
    ? formatSourcePages(item.source)
    : item.type === 'image' && item.page
      ? String(item.page)
      : null
  const docName = item.source?.docName

  return (
    <div
      id={id}
      data-testid="ai-draft-preview"
      className="mx-3 mt-1 mb-1 flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-zinc-950/40 p-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-ql-10 text-muted-foreground tracking-ql-label shrink-0 font-semibold uppercase">
          {item.type === 'text' ? t('ai_draft_item_text') : t('ai_draft_item_image')}
        </span>
        {pageLabel && (
          <span className="text-ql-10 text-muted-foreground shrink-0 font-mono tabular-nums">
            · {pageLabel}
          </span>
        )}
        {docName && (
          <span className="text-ql-10 text-muted-foreground ml-auto max-w-[60%] truncate">
            {docName}
          </span>
        )}
      </div>

      {item.type === 'text' ? (
        <p className="custom-scrollbar text-ql-12 text-foreground max-h-40 overflow-y-auto leading-relaxed break-words whitespace-pre-wrap">
          {item.text}
        </p>
      ) : item.blobUrl ? (
        <img
          src={item.blobUrl}
          alt=""
          className="max-h-40 w-fit max-w-full rounded-lg border border-white/[0.07] object-contain"
        />
      ) : (
        <p className="text-ql-11 text-muted-foreground">{t('ai_draft_preview_unavailable')}</p>
      )}
    </div>
  )
}

export default memo(DraftItemChips)
