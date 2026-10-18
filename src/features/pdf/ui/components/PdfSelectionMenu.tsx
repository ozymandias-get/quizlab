import { DURATION } from '@shared/lib/motion'

import { BookmarkPlus, Info, Loader2, Send } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DEFAULT_SELECTION_MENU_SIZE } from '../../text/selectionPage'

/**
 * Yalnızca **çalışma** ve **hata** durumları vardır.
 *
 * `added` / `sent` / `staged` bilinçli olarak kaldırıldı. Menü bu eylemlerden
 * sonra zaten kapanır ve içerik taslakta ya da AI kutusunda görünür duruma
 * geçer; menünün kendi satırında tekrar "eklendi / gönderildi" yazması aynı
 * olayı üçüncü kez söyleyip ekranı gereksiz meşgul ederdi. Hata ise kalır:
 * kuyruk reddettiğinde içerik kullanıcının elinde **kalmaz**, bunu söylemek
 * zorunludur.
 */
export type SelectionMenuFeedback = 'idle' | 'working' | 'error'

interface PdfSelectionMenuProps {
  top: number
  left: number
  feedback?: SelectionMenuFeedback
  disabled?: boolean
  onSendToAi: () => void
  onAddToDraft: () => void
}

/** Viewport kenarına karşı tek seferlik DOM ölçümlü kelepçe (mount/konum değişimi). */
const EDGE_MARGIN = 8

/**
 * PDF seçiminde doğrudan beliren ikili eylem menüsü.
 *
 * Görsel dil `MenuSurface` ile aynı kütleden: popover yüzeyi,
 * `shadow-ambient-lg`, `rounded-xl`, 1px kenarlık, hafif backdrop blur.
 *
 * - İki eylem yan yana, dengeli genişlikte, ayrı ikonlu, kesintisiz metin.
 * - Açık/koyu temada uyumlu; hover ve `focus-visible` halkası belirgin.
 * - Hareket yalnızca açılışta kısa opaklık + 3px yukarı geçişi; konum
 * sabit kalır. `prefers-reduced-motion` altında geçiş tamamen düşer.
 * - Geri bildirim (eklendi / gönderildi / hazırlandı / hata) aynı yüzeyde
 * satır içinde gösterilir; menü konumundan kaymaz.
 *
 * Ölçüler sabittir (`DEFAULT_SELECTION_MENU_SIZE`) ve konumlandırma bu
 * ölçüyü kullanır; buna karşılık ilk yerleşimde gerçek DOM yüzeyi ölçülüp
 * viewport taşmasına karşı tek kez düzeltme uygulanır (zamanlayıcı yok).
 */
function PdfSelectionMenu({
  top,
  left,
  feedback = 'idle',
  disabled,
  onSendToAi,
  onAddToDraft
}: PdfSelectionMenuProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const isBusy = feedback === 'working' || disabled
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [nudge, setNudge] = useState<{ x: number; y: number } | null>(null)

  // Gerçek DOM ölçüsü → tek konum düzeltmesi (her konum değişiminde bir kez).
  useLayoutEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    setNudge(null)
    const rect = el.getBoundingClientRect()
    let dx = 0
    let dy = 0
    if (rect.right > window.innerWidth - EDGE_MARGIN) {
      dx = window.innerWidth - EDGE_MARGIN - rect.right
    }
    if (rect.left < EDGE_MARGIN) dx = EDGE_MARGIN - rect.left
    if (rect.bottom > window.innerHeight - EDGE_MARGIN) {
      dy = window.innerHeight - EDGE_MARGIN - rect.bottom
    }
    if (rect.top < EDGE_MARGIN) dy = EDGE_MARGIN - rect.top
    if (dx !== 0 || dy !== 0) setNudge({ x: dx, y: dy })
  }, [top, left])

  const feedbackNode = (): {
    key: string
    icon: React.ReactNode
    text: string
    tone: string
  } | null => {
    if (feedback === 'error') {
      return {
        key: 'error',
        icon: (
          <span
            className="bg-destructive/12 text-destructive flex size-7 shrink-0 items-center justify-center rounded-lg"
            aria-hidden
          >
            <Info className="size-4" strokeWidth={2} />
          </span>
        ),
        text: t('ai_send_error'),
        tone: 'text-destructive'
      }
    }
    return null
  }

  const feedbackContent = feedbackNode()

  return (
    <motion.div
      ref={surfaceRef}
      role="menu"
      aria-label={t('pdf_selection_menu_label', { defaultValue: 'Seçim işlemleri' })}
      aria-busy={feedback === 'working'}
      data-testid="pdf-selection-menu"
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.fast, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        top,
        left,
        width: DEFAULT_SELECTION_MENU_SIZE.width,
        transform: nudge ? `translate(${nudge.x}px, ${nudge.y}px)` : undefined
      }}
      className="border-border/55 bg-popover/92 text-popover-foreground shadow-ambient-lg z-dropdown motion-normal fixed rounded-2xl border p-1 backdrop-blur-2xl"
      onMouseDown={(e) => {
        // Menüye tıklanınca metin seçimi kaybolmasın: içerik zaten snapshot'ta,
        // ama seçim kaybı yeni bir selectionchange tetikleyip menüyü kapatırdı.
        e.preventDefault()
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {feedbackContent ? (
          <motion.div
            key="feedback"
            data-testid="pdf-selection-menu-feedback"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2"
          >
            {feedbackContent.icon}
            <span className={['text-ql-12 min-w-0 font-medium', feedbackContent.tone].join(' ')}>
              {feedbackContent.text}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="flex items-stretch gap-1"
          >
            <button
              type="button"
              role="menuitem"
              data-testid="pdf-selection-send"
              disabled={isBusy}
              onClick={onSendToAi}
              style={{
                backgroundColor: 'var(--selection-color-source, oklch(var(--primary)))',
                color: 'var(--selection-color-ink, oklch(var(--primary-foreground)))'
              }}
              className="focus-visible:ring-ring/40 group text-ql-12 flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 font-semibold whitespace-nowrap shadow-2xs transition-all hover:brightness-105 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
                {feedback === 'working' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" strokeWidth={2.2} />
                )}
              </span>
              <span className="truncate">{t('send_to_ai')}</span>
            </button>

            <button
              type="button"
              role="menuitem"
              data-testid="pdf-selection-draft"
              disabled={isBusy}
              onClick={onAddToDraft}
              className="hover:bg-muted/75 focus-visible:bg-muted/75 focus-visible:ring-ring/40 group text-ql-12 text-foreground flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              <span
                style={{ color: 'var(--selection-color-source, oklch(var(--primary)))' }}
                className="text-primary flex size-4 shrink-0 items-center justify-center transition-colors"
                aria-hidden
              >
                <BookmarkPlus className="size-3.5" strokeWidth={2} />
              </span>
              <span className="truncate">
                {t('pdf_add_to_draft', { defaultValue: 'Taslağa Ekle' })}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default memo(PdfSelectionMenu)
