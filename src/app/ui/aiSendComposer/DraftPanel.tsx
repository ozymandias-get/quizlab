import { DURATION } from '@shared/lib/motion'
import { cn } from '@shared/lib/uiUtils'
import { IconButton } from '@shared/ui/components/primitives'

import { Image as ImageIcon, Send, Type, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface DraftPanelProps {
  isOpen: boolean
  placement: 'inline' | 'floating'
  children: ReactNode
}

/**
 * Taslak paneli — açıldığında kompakt, öngörülebilir, kararlı yükseklikte.
 *
 * `inline` yerleşimde PDF panelinin yuvasının içinde rozetten yukarı açılır;
 * `floating` yedeğinde (PDF paneli kapalıysa) alt-sol köşede konumlanır.
 * Yükseklik tavanı sabittir; not yazarken veya içerik eklerken zıplama yapmaz.
 * Panel kapanınca taslak korunur.
 */
function DraftPanel({ isOpen, placement, children }: DraftPanelProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ai-draft-panel"
          role="dialog"
          aria-label="AI Taslağı"
          data-testid="ai-draft-panel"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
          transition={{ duration: DURATION.normal, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn(
            'border-border bg-card text-foreground shadow-ambient-xl pointer-events-auto flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border',
            // Yuva PDF panelinde: panel rozetten yukarı açılır, panelin içinde kalır.
            placement === 'inline' ? 'absolute right-0 bottom-full mb-2' : 'relative'
          )}
          style={{ maxHeight: 'min(62vh, 540px)' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Panel başlığı: kimlik + tür rozetleri + kapat. */
export function DraftPanelHeader({
  textCount,
  imageCount,
  onClose
}: {
  textCount: number
  imageCount: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <header className="border-border/70 flex items-start gap-2.5 border-b px-3.5 py-3">
      <span
        className="border-primary/15 bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-xl border"
        aria-hidden
      >
        <Send className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ql-13 truncate leading-tight font-semibold">
          {t('ai_send_panel_title')}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {textCount > 0 && (
            <span className="bg-muted text-muted-foreground text-ql-11 flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium">
              <Type className="size-3" aria-hidden />
              {t('ai_draft_item_text')}
              <span className="text-foreground tabular-nums">{textCount}</span>
            </span>
          )}
          {imageCount > 0 && (
            <span className="bg-muted text-muted-foreground text-ql-11 flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium">
              <ImageIcon className="size-3" aria-hidden />
              {t('ai_draft_item_image')}
              <span className="text-foreground tabular-nums">{imageCount}</span>
            </span>
          )}
        </div>
      </div>
      <IconButton
        type="button"
        variant="ghost"
        size="compact"
        onClick={onClose}
        aria-label={t('ai_draft_close')}
        aria-expanded
        className="text-muted-foreground hover:bg-muted hover:text-foreground -mt-0.5 shrink-0"
      >
        <X className="size-4" aria-hidden />
      </IconButton>
    </header>
  )
}

export default memo(DraftPanel)
