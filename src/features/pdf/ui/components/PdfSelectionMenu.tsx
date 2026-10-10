import { DURATION } from '@shared/lib/motion'

import { BookmarkPlus, Check, Loader2, Send } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export type SelectionMenuFeedback = 'idle' | 'working' | 'added' | 'sent' | 'error'

interface PdfSelectionMenuProps {
  top: number
  left: number
  feedback?: SelectionMenuFeedback
  addedCount?: number
  disabled?: boolean
  onSendToAi: () => void
  onAddToDraft: () => void
}

/**
 * PDF seçiminde doğrudan beliren ikili eylem menüsü.
 *
 * Görsel dil `MenuSurface` ile aynı kütphaneden gelir (popover yüzeyi,
 * `shadow-ambient-lg`, `rounded-xl`, 1px kenarlık, hafif backdrop blur) ve
 * bağlam menüsünün yanında durduğunda ikisi de "aynı aileden" görünür.
 *
 * Hareket yalnızca kullanıcı eylemini anlamaya yardım eder: açılışta kısa bir
 * opaklık + 3px yukarı geçiş, konum sabit kalır (menü konumlanmış yerde
 * doğar, sürüklenmez). `prefers-reduced-motion` altında geçiş tamamen düşer.
 */
function PdfSelectionMenu({
  top,
  left,
  feedback = 'idle',
  addedCount,
  disabled,
  onSendToAi,
  onAddToDraft
}: PdfSelectionMenuProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const isBusy = feedback === 'working' || disabled

  return (
    <motion.div
      role="menu"
      aria-label={t('pdf_selection_menu_label', { defaultValue: 'Seçim işlemleri' })}
      aria-busy={feedback === 'working'}
      data-testid="pdf-selection-menu"
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.fast, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ top, left }}
      className="border-border bg-popover/95 text-popover-foreground shadow-ambient-lg z-dropdown motion-normal fixed w-[252px] rounded-xl border p-1 backdrop-blur-md"
      onMouseDown={(e) => {
        // Menüye tıklanınca metin seçimi kaybolmasın: içerik zaten snapshot'ta,
        // ama seçim kaybı yeni bir selectionchange tetikleyip menüyü kapatırdı.
        e.preventDefault()
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {feedback === 'added' || feedback === 'sent' ? (
          <motion.div
            key="feedback"
            data-testid="pdf-selection-menu-feedback"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            >
              <Check className="size-4" strokeWidth={2.5} />
            </span>
            <span className="text-ql-12 min-w-0 truncate font-medium">
              {feedback === 'sent'
                ? t('ai_send_sent')
                : t('pdf_draft_added', {
                    count: addedCount ?? 1,
                    defaultValue: `Taslağa eklendi · ${addedCount ?? 1} içerik`
                  })}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="flex items-stretch"
          >
            <button
              type="button"
              role="menuitem"
              data-testid="pdf-selection-send"
              disabled={isBusy}
              onClick={onSendToAi}
              className="hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-ring/40 group text-ql-12 flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2.5 font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              <span
                className="bg-primary/12 text-primary group-hover:bg-primary/18 flex size-5 shrink-0 items-center justify-center rounded-md transition-colors"
                aria-hidden
              >
                {feedback === 'working' ? (
                  <Loader2 className="text-primary size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" strokeWidth={2} />
                )}
              </span>
              <span className="truncate">{t('send_to_ai')}</span>
            </button>

            <span aria-hidden className="bg-border/70 my-1.5 w-px shrink-0" />

            <button
              type="button"
              role="menuitem"
              data-testid="pdf-selection-draft"
              disabled={isBusy}
              onClick={onAddToDraft}
              className="hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-ring/40 group text-ql-12 flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2.5 font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              <span
                className="bg-muted text-muted-foreground group-hover:bg-primary/12 group-hover:text-primary flex size-5 shrink-0 items-center justify-center rounded-md transition-colors"
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
