import { cn } from '@shared/lib/uiUtils'
import { Button, WithTooltip } from '@shared/ui/components/primitives'

import {
  AlertCircle,
  ChevronUp,
  FileText,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  TriangleAlert
} from 'lucide-react'
import { memo, useId } from 'react'
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
  /**
   * Aktif talimatların kısa adları (hızlı işlem, ek not). Tek bir kompakt
   * göstergeye sığar; uzun etiketler satırı doldurmaz, tamamı tooltip'te okunur.
   */
  instructionLabels?: string[]
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
  statusTone = 'neutral',
  instructionLabels = []
}: DraftDockBarProps) {
  const { t } = useTranslation()

  const intent = resolveDraftSendIntent({ autoSend, feedback, isSubmitting: isSending })
  const sendLabel = t(DRAFT_SEND_INTENT_KEYS[intent])
  // Kısmi uygulama ve süren gönderim: iki durumda da yeni bir iş başlatılamaz.
  const canSend = itemCount > 0 && isDraftSendIntentActionable(intent)
  const instructionLabel = instructionLabels.join(' · ')
  const instructionsId = useId()

  const SendIcon = intent === 'sending' ? Loader2 : intent === 'retry' ? RotateCcw : Send
  // Dar hapta durum metni ikona iner; ikon her genişlikte görünür kalır ve
  // metin `sr-only` olarak duyurulmaya devam eder (kritik hata kaybolmaz).
  const StatusIcon =
    statusTone === 'error' ? AlertCircle : statusTone === 'warning' ? TriangleAlert : Loader2

  const toneClasses =
    statusTone === 'error'
      ? 'border border-destructive/30 bg-destructive/12 text-destructive'
      : statusTone === 'warning'
        ? 'border border-amber-500/30 bg-amber-500/12 text-amber-400'
        : 'bg-primary/10 text-primary'

  return (
    <div
      data-testid="ai-draft-dock-bar"
      className="motion-normal mx-auto flex h-10 max-w-full items-center gap-1 rounded-full border border-white/[0.09] bg-zinc-950/95 p-1 shadow-xl backdrop-blur-xl transition-all hover:border-white/20"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? t('ai_draft_close') : t('ai_draft_open')}
        aria-describedby={instructionLabel ? instructionsId : undefined}
        data-testid="ai-draft-badge"
        className="group focus-visible:ring-ring/70 flex h-full min-w-0 flex-1 items-center gap-2 rounded-full pr-2.5 pl-1 text-left transition-colors hover:bg-white/10 focus-visible:ring-1 focus-visible:outline-none"
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

        <span
          data-testid="ai-draft-dock-title"
          className="text-ql-12 text-foreground tracking-ql-tight shrink-0 font-semibold @max-[20rem]:hidden"
        >
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
            'text-ql-10 shrink-0 rounded-full px-2 py-0.5 font-semibold tabular-nums transition-colors @max-[15rem]:hidden',
            itemCount > 0 ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-white/10'
          )}
        >
          {t('ai_draft_content_count', { count: itemCount })}
        </span>

        {instructionLabel && (
          <span
            id={instructionsId}
            title={instructionLabel}
            data-testid="ai-draft-instruction-hint"
            className="text-muted-foreground/70 flex size-4 shrink-0 items-center justify-center @max-[22rem]:hidden"
          >
            <FileText className="size-3" aria-hidden />
            <span className="sr-only">{instructionLabel}</span>
          </span>
        )}

        {statusLabel && (
          <span
            role="status"
            aria-live="polite"
            title={statusLabel}
            className="flex min-w-0 shrink items-center gap-1"
          >
            <StatusIcon
              aria-hidden
              className={cn(
                'size-3.5 shrink-0 @min-[24rem]:hidden',
                statusTone === 'neutral' && isSending && 'animate-spin',
                statusTone === 'error' && 'text-destructive',
                statusTone === 'warning' && 'text-amber-400',
                statusTone === 'neutral' && 'text-muted-foreground'
              )}
            />
            <span
              className={cn(
                'text-ql-11 max-w-[12rem] truncate font-medium @max-[24rem]:sr-only',
                statusTone === 'error' && 'text-destructive',
                statusTone === 'warning' && 'text-amber-400',
                statusTone === 'neutral' && 'text-muted-foreground'
              )}
            >
              {statusLabel}
            </span>
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
            className={cn(
              'text-ql-11 h-8 shrink-0 gap-1.5 rounded-full px-3.5 font-semibold transition-all',
              canSend
                ? 'bg-zinc-100 text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.12)] hover:bg-white hover:shadow-[0_0_24px_rgba(255,255,255,0.18)]'
                : 'border-0 bg-zinc-800 text-zinc-400 opacity-100 shadow-none hover:bg-zinc-800'
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
