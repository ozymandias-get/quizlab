import { cn } from '@shared/lib/uiUtils'
import { Button, WithTooltip } from '@shared/ui/components/primitives'

import { ChevronUp, Loader2, RotateCcw, Send, Sparkles } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DRAFT_SEND_INTENT_KEYS,
  isDraftSendIntentActionable,
  resolveDraftSendIntent
} from './draftSendIntent'
import type { SendFeedback } from './types'

interface DraftDockBarProps {
  itemCount: number
  autoSend: boolean
  isSending: boolean
  feedback: SendFeedback
  isOpen: boolean
  onToggle: () => void
  /** Hap üzerinden doğrudan gönderim; panel açılmadan aynı yolu kullanır. */
  onSend: () => void
  /**
   * Dock kapalıyken de anlaşılır olması gereken durum (gönderiliyor / sonuç).
   * Boş string ise gösterilmez; hapın içinde kısa bir rozet olarak durur.
   */
  statusLabel?: string
  statusTone?: 'neutral' | 'warning' | 'error'
}

/**
 * Kapalı dock — PDF yüzeyinin altında duran yüzen hap.
 *
 * Ekranı kaplayan bir şerit değil, kartın en küçük hali: cam yüzey, yuvarlak
 * kenar, ikon rozeti + ad + sayı + durum. PDF'in alt kenarından `p-3/p-4` içeri
 * boşlukla ayrıldığı için sayfanın alt kenarı her zaman görünür kalır.
 *
 * **Kuyruk doluyken gönder düğmesi de burada durur.** Açmak, yazmak, göndermek
 * üç ayrı adımdı; "gönder" tek tık uzaktayken paneli açmak gereksiz bir ara
 * adımıydı. Düğme yalnızca `itemCount > 0` iken görünür, panel açıldığında yoktur
 * (aynı eylem orada zaten var) ve kapandığında da kaybolmaz — gönderim sırasında
 * yerini korur, genişlik zıplamaz.
 *
 * Hiyerarşi: **ad + sayı → tek belirgin eylem**. Durum rozeti ancak bir sonuç
 * varken görünür ve `role="status"` ile duyurulur; renk tek başına anlam taşımaz.
 */
function DraftDockBar({
  itemCount,
  autoSend,
  isSending,
  feedback,
  isOpen,
  onToggle,
  onSend,
  statusLabel,
  statusTone = 'neutral'
}: DraftDockBarProps) {
  const { t } = useTranslation()

  const intent = resolveDraftSendIntent({ autoSend, feedback, isSubmitting: isSending })
  const sendLabel = t(DRAFT_SEND_INTENT_KEYS[intent])
  // Kısmi uygulama: içerik zaten hedefe ulaştı; yeniden göndermek mükerrer
  // mesaj bırakır, bu yüzden hap üzerindeki düğme de devre dışıdır.
  const canSend = itemCount > 0 && isDraftSendIntentActionable(intent)

  const SendIcon = intent === 'sending' ? Loader2 : intent === 'retry' ? RotateCcw : Send

  const toneClasses =
    statusTone === 'error'
      ? 'border border-destructive/30 bg-destructive/12 text-destructive'
      : statusTone === 'warning'
        ? 'border border-amber-500/30 bg-amber-500/12 text-amber-600 dark:text-amber-400'
        : 'bg-primary/10 text-primary'

  return (
    <div
      data-testid="ai-draft-dock-bar"
      className="border-border/50 bg-popover/88 hover:border-border/75 shadow-ambient-md hover:shadow-ambient-lg motion-normal mx-auto flex h-10 max-w-full items-center gap-1 rounded-full border p-1 backdrop-blur-2xl transition-all"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="ai-draft-dock-body"
        aria-label={isOpen ? t('ai_draft_close') : t('ai_draft_open')}
        data-testid="ai-draft-badge"
        className="group hover:bg-muted/55 focus-visible:ring-ring/40 flex h-full min-w-0 flex-1 items-center gap-2 rounded-full pr-2.5 pl-1 text-left transition-colors focus-visible:ring-1 focus-visible:outline-none"
      >
        <span
          style={
            statusTone === 'neutral'
              ? {
                  color: 'var(--selection-color-source, oklch(var(--primary)))',
                  backgroundColor:
                    'color-mix(in oklch, var(--selection-color-source, oklch(var(--primary))) 15%, transparent)'
                }
              : undefined
          }
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
            toneClasses
          )}
          aria-hidden
        >
          {isSending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
        </span>

        <span className="text-ql-12 text-foreground shrink-0 font-semibold tracking-tight">
          {t('ai_draft_badge')}
        </span>

        <span
          style={
            itemCount > 0
              ? {
                  color: 'var(--selection-color-source, oklch(var(--primary)))',
                  backgroundColor:
                    'color-mix(in oklch, var(--selection-color-source, oklch(var(--primary))) 14%, transparent)'
                }
              : undefined
          }
          className={cn(
            'text-ql-10 shrink-0 rounded-full px-2 py-0.5 font-semibold tabular-nums transition-colors',
            itemCount > 0 ? 'text-primary bg-primary/10' : 'bg-muted/70 text-muted-foreground/80'
          )}
        >
          {t('ai_draft_content_count', { count: itemCount })}
        </span>

        {statusLabel && (
          <span
            role="status"
            aria-live="polite"
            className={cn(
              'text-ql-11 max-w-[12rem] truncate font-medium @max-[24rem]:hidden',
              statusTone === 'error' && 'text-destructive',
              statusTone === 'warning' && 'text-amber-600 dark:text-amber-400',
              statusTone === 'neutral' && 'text-muted-foreground'
            )}
          >
            {statusLabel}
          </span>
        )}

        <ChevronUp
          className="text-muted-foreground/70 group-hover:text-foreground ml-0.5 size-3.5 shrink-0 transition-transform group-hover:-translate-y-px"
          aria-hidden
        />
      </button>

      {/* İki düğme kardeş, iç içe değil: `<button>` içine `<button>` geçersiz HTML'dir
          ve ekran okuyucular tıklama hedefini kaybeder. */}
      {itemCount > 0 && (
        <WithTooltip label={sendLabel}>
          <Button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            size="sm"
            aria-label={sendLabel}
            data-testid="ai-draft-pill-send"
            style={
              canSend
                ? {
                    backgroundColor: 'var(--selection-color-source, oklch(var(--primary)))',
                    color: 'var(--selection-color-ink, oklch(var(--primary-foreground)))'
                  }
                : undefined
            }
            className={cn(
              'text-ql-11 h-8 shrink-0 gap-1.5 rounded-full px-3.5 font-semibold shadow-2xs transition-all hover:brightness-105 active:scale-[0.98]',
              !canSend &&
                'bg-muted/70 text-muted-foreground/70 hover:bg-muted/70 opacity-100 shadow-none'
            )}
          >
            <SendIcon
              className={cn('size-3.5', intent === 'sending' && 'animate-spin')}
              aria-hidden
            />
            {/* Dar panelde etiket ikona iner; `aria-label` erişilebilir adı her
                genişlikte korur, gönderim dar PDF panelinde de ulaşılabilir kalır. */}
            <span className="@max-[24rem]:hidden">{sendLabel}</span>
          </Button>
        </WithTooltip>
      )}
    </div>
  )
}

export default memo(DraftDockBar)
