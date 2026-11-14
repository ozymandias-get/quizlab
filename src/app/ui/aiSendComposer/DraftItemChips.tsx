import { formatSourcePages } from '@app/providers/ai/pdfSource'
import type { AiDraftItem } from '@app/providers/ai/types'
import { cn } from '@shared/lib/uiUtils'
import { IconButton, WithTooltip } from '@shared/ui/components/primitives'

import { Image as ImageIcon, Loader2, Type, X } from 'lucide-react'
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface DraftItemChipsProps {
  items: AiDraftItem[]
  onRemoveItem?: (id: string) => void
  /** Gönderim sürerken kuyruğu değiştirmeyi kapatır (snapshot zaten alınmıştır). */
  disabled?: boolean
}

/** Son öğe silindiğinde odak bu düzenleme yüzeyine döner. */
const NOTE_FIELD_ID = 'ai-draft-note'

/**
 * Taslak içerikleri — yatay kaydırılabilen kompakt chip şeridi + isteğe bağlı
 * tek öğe önizlemesi.
 *
 * Varsayılan görünüm değişmedi: tür + sıra + kaynak sayfa. Bir chip'e
 * tıklamak (veya Enter/Space) **yalnızca o öğenin** hafif önizlemesini açar;
 * aynı anda tek önizleme vardır ve varsayılan olarak kapalıdır. Görsel
 * önizlemesi kuyruğun ürettiği `blobUrl`'i tercih eder; blob henüz yoksa
 * bellekteki `dataUrl` doğrudan `src` olarak kullanılır — base64 dönüşümü,
 * yeniden encode veya yeni bir kopya üretilmez.
 */
function DraftItemChips({ items, onRemoveItem, disabled = false }: DraftItemChipsProps) {
  const { t } = useTranslation()
  const [previewId, setPreviewId] = useState<string | null>(null)
  const previewPanelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const triggersRef = useRef(new Map<string, HTMLButtonElement>())
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false })
  const previewItem = items.find((item) => item.id === previewId) ?? null

  const focusTrigger = (id: string) => {
    // Öğe kaldırıldığında/kapatıldığında odak kaybolmaz: bir sonraki chip'in
    // gerçek düğmesine döner.
    triggersRef.current.get(id)?.focus()
  }

  const handleTogglePreview = (id: string) => {
    setPreviewId((current) => (current === id ? null : id))
  }

  const handleRemove = (id: string) => {
    if (!onRemoveItem) return
    const index = items.findIndex((item) => item.id === id)
    const nextId = items[index + 1]?.id ?? items[index - 1]?.id ?? null
    if (previewId === id) setPreviewId(null)
    onRemoveItem(id)
    if (nextId) focusTrigger(nextId)
    // Son öğe silindi: odak boşluğa düşmesin, panelin not alanına dönsün.
    else document.getElementById(NOTE_FIELD_ID)?.focus()
  }

  const updateScrollHint = useCallback(() => {
    const el = stripRef.current
    if (!el) return
    // Her iki kenar ayrı raporlanır: liste ortasında iki ipucu da görünür,
    // başında yalnızca sağ, sonunda yalnızca sol kalır.
    const next = {
      left: el.scrollLeft > 1,
      right: el.scrollWidth - el.clientWidth - el.scrollLeft > 1
    }
    setScrollEdges((current) =>
      current.left === next.left && current.right === next.right ? current : next
    )
  }, [])

  // Yatay şeritte gizli içerik varsa kenarda hafif bir gradyan gösterilir;
  // kaydırma çubuğu gizli kaldığı için keşfedilebilirlik korunur.
  useEffect(() => {
    updateScrollHint()
    const el = stripRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateScrollHint)
    observer.observe(el)
    return () => observer.disconnect()
  }, [items, updateScrollHint])

  // Önizleme açıkken öğe başka bir işlemle (temizleme, dış kuyruk güncellemesi)
  // kaldırılabilir. `previewId` bayat bırakılırsa "geri al" aynı öğeyi geri
  // getirdiğinde önizleme kendiliğinden açılırdı; kimlik burada bırakılır.
  useEffect(() => {
    if (!previewId) return
    if (items.some((item) => item.id === previewId)) return
    setPreviewId(null)
    // Odak, silinen chip'te kaldıysa boşluğa düşmesin. Kullanıcı başka bir
    // yerdeyse odağı çalma.
    if (document.activeElement === document.body) {
      document.getElementById(NOTE_FIELD_ID)?.focus()
    }
  }, [items, previewId])

  // Escape — odak chip şeridinin içindeyken önizlemeyi kapatır ve odağı
  // açan chip'e geri verir. Odak not alanındaysa tetiklenmez.
  useEffect(() => {
    if (!previewId) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!rootRef.current?.contains(document.activeElement)) return
      const id = previewId
      setPreviewId(null)
      triggersRef.current.get(id)?.focus()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [previewId])

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
    <div ref={rootRef}>
      <div className="relative">
        <div
          ref={stripRef}
          data-testid="ai-draft-chip-strip"
          onScroll={updateScrollHint}
          className="custom-scrollbar scrollbar-hidden overflow-x-auto overflow-y-hidden px-3 pt-2.5 pb-0.5"
        >
          <ul className="flex w-max items-center gap-2" aria-label={t('ai_send_panel_title')}>
            {items.map((item, index) => (
              <DraftItemChip
                key={item.id}
                item={item}
                order={index + 1}
                onRemove={disabled ? undefined : handleRemove}
                isPreviewOpen={previewId === item.id}
                previewControlsId={previewPanelId}
                onTogglePreview={() => handleTogglePreview(item.id)}
                registerTrigger={(node) => {
                  if (node) triggersRef.current.set(item.id, node)
                  else triggersRef.current.delete(item.id)
                }}
              />
            ))}
          </ul>
        </div>
        {scrollEdges.left && (
          <span
            aria-hidden
            data-testid="ai-draft-scroll-left"
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-zinc-950 to-transparent"
          />
        )}
        {scrollEdges.right && (
          <span
            aria-hidden
            data-testid="ai-draft-scroll-right"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-zinc-950 to-transparent"
          />
        )}
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
  onTogglePreview,
  registerTrigger
}: {
  item: AiDraftItem
  order: number
  onRemove?: (id: string) => void
  isPreviewOpen: boolean
  previewControlsId: string
  onTogglePreview: () => void
  registerTrigger: (node: HTMLButtonElement | null) => void
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
          'group motion-normal flex h-8 shrink-0 items-center gap-1 rounded-lg border pr-0.5 pl-1 transition-all',
          isPreviewOpen
            ? 'border-white/20 bg-white/[0.07]'
            : 'border-white/[0.07] bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
        )}
        data-testid="ai-draft-item"
      >
        <button
          ref={registerTrigger}
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
              // Görsel kutu 24px kalır (chip yüksekliği büyümez), ancak görünmez
              // `after` alanı dikeyde 32px'e ve sağa doğru genişletir: dokunmatik
              // hedef büyür, yanlışlıkla önizleme açma riski artmaz.
              'text-muted-foreground/70 hover:bg-destructive/12 hover:text-destructive relative size-6 shrink-0 rounded-md p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 after:absolute after:-inset-y-1 after:right-0 after:left-0 after:content-[""] focus-visible:opacity-100 motion-reduce:opacity-100 pointer-coarse:opacity-100'
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
  const imageSrc = item.type === 'image' ? item.blobUrl || item.dataUrl || null : null
  /**
   * Yükleme durumu **kaynağa bağlı** tutulur. A öğesinden B'ye geçildiğinde
   * aynı bileşen örneği kullanılsa bile B, A'nın `ready` durumunu bir kare
   * bile devralmaz: kaynak eşleşmiyorsa durum yeniden `loading`dir.
   */
  const [imageStatus, setImageStatus] = useState<{
    src: string | null
    status: 'loading' | 'ready' | 'failed'
  }>(() => ({ src: imageSrc, status: imageSrc ? 'loading' : 'failed' }))
  const imageState: 'loading' | 'ready' | 'failed' =
    imageStatus.src !== imageSrc ? (imageSrc ? 'loading' : 'failed') : imageStatus.status

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
        <p className="text-ql-12 text-foreground leading-relaxed break-words whitespace-pre-wrap">
          {item.text}
        </p>
      ) : (
        <>
          {imageState === 'loading' && (
            <p className="text-ql-11 text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              {t('ai_draft_preview_preparing')}
            </p>
          )}
          {imageState === 'failed' && (
            <p className="text-ql-11 text-muted-foreground">{t('ai_draft_preview_unavailable')}</p>
          )}
          {imageSrc && (
            <img
              src={imageSrc}
              alt=""
              onLoad={() => setImageStatus({ src: imageSrc, status: 'ready' })}
              onError={() => setImageStatus({ src: imageSrc, status: 'failed' })}
              className={cn(
                'max-h-[min(10rem,28dvh)] w-fit max-w-full rounded-lg border border-white/[0.07] object-contain',
                imageState !== 'ready' && 'hidden'
              )}
            />
          )}
        </>
      )}
    </div>
  )
}

export default memo(DraftItemChips)
