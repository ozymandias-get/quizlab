import { Switch } from '@app/components/ui/switch'
import { cn } from '@shared/lib/uiUtils'
import { Button, WithTooltip } from '@shared/ui/components/primitives'

import { AlertCircle, CheckCircle2, Info, Loader2, RotateCcw, Send } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { DRAFT_SEND_INTENT_KEYS, resolveDraftSendIntent } from './draftSendIntent'
import type { SendFeedback } from './types'

interface DraftSendControlsProps {
  autoSend: boolean
  onToggleAutoSend: () => void
  onRetry: () => void
  feedback: SendFeedback
  lastError: string | null
  isSubmitting: boolean
}

/**
 * Alt durum satırı — otomatik gönderim anahtarı + sonuç.
 *
 * Ana eylem burada değildir; gönderim butonu composer'ın araç satırının sağ
 * ucundadır. Bu satır yalnızca "hangi modda olduğumuz" ve "ne oldu" sorusunu
 * yanıtlar, bu yüzden tek satırda kalır.
 *
 * Durum modeli bilinçli olarak ayrıdır:
 *  - `success` → içerik gerçekten iletildi ("Gönderildi").
 *  - `staged`  → içerik AI kutusuna hazırlandı, kullanıcı gönderacak.
 */
function DraftSendControls({
  autoSend,
  onToggleAutoSend,
  onRetry,
  feedback,
  lastError,
  isSubmitting
}: DraftSendControlsProps) {
  const { t } = useTranslation()

  const statusLabel =
    feedback === 'sending'
      ? t('sending_to_ai')
      : feedback === 'success'
        ? t('ai_send_sent')
        : feedback === 'staged'
          ? t('ai_send_staged')
          : feedback === 'error'
            ? (lastError ?? t('ai_send_error'))
            : null

  const StatusIcon =
    feedback === 'sending'
      ? Loader2
      : feedback === 'success'
        ? CheckCircle2
        : feedback === 'staged'
          ? Info
          : feedback === 'error'
            ? AlertCircle
            : null

  const statusTone =
    feedback === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : feedback === 'error'
        ? 'text-destructive'
        : feedback === 'sending' || feedback === 'staged'
          ? 'text-foreground'
          : 'text-muted-foreground'

  return (
    <div className="border-border/50 bg-muted/20 flex h-8 shrink-0 items-center gap-2 border-t px-3">
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 select-none">
        <Switch
          size="sm"
          checked={!!autoSend}
          onCheckedChange={onToggleAutoSend}
          // Erişilebilir ad açık/kapalı olmayı da söyler; görünen kısa etiket
          // ekran okuyucu için tek başına yetersiz.
          aria-label={autoSend ? t('auto_send_on') : t('auto_send_off')}
        />
        <span className="text-ql-11 text-muted-foreground font-medium">
          {t('ai_send_mode_auto')}
        </span>
        {/* Anahtar tek başına durumu söylemez; kısa metin hem "Açık/Kapalı"
            hem de auto-send'in ne anlama geldiğini görünür kılar. */}
        <span
          className={cn(
            'text-ql-10 shrink-0 font-medium',
            autoSend ? 'text-primary' : 'text-muted-foreground/70'
          )}
        >
          {autoSend ? t('ai_send_auto_on') : t('ai_send_auto_off')}
        </span>
      </label>

      {feedback === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          className="text-muted-foreground hover:bg-muted hover:text-foreground text-ql-11 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors"
        >
          <RotateCcw className="size-3 shrink-0" aria-hidden />
          {t('ai_send_retry')}
        </button>
      )}

      <span className="flex-1" />

      {/* Durum yalnızca anlamlı olduğunda yer alır; başlık zaten içerik sayısını
          gösterdiği için boşta "0 öğe" tekrarı yoktur. */}
      {statusLabel && StatusIcon && (
        <div className="flex min-w-0 shrink items-center gap-1" role="status" aria-live="polite">
          <StatusIcon
            className={cn(
              'size-3.5 shrink-0',
              isSubmitting && feedback === 'sending' && 'animate-spin',
              statusTone
            )}
            aria-hidden
          />
          <span className={cn('text-ql-11 truncate font-medium', statusTone)}>{statusLabel}</span>
        </div>
      )}
    </div>
  )
}

interface DraftSendButtonProps {
  autoSend: boolean
  onSend: () => void
  feedback: SendFeedback
  totalItems: number
  isSubmitting: boolean
}

/**
 * Ana gönderim eylemi — composer araç satırının sağ ucu.
 *
 * İkincil kontrollerden görünür biçimde ayrışır: etkinken primary dolgu, eylem
 * adı metinle birlikte verilir. Auto-send kapalıyken etiket "hazırla" olur ve
 * `staged` sonucu "gönderildi" diye raporlanmaz — davranış değişmez, yalnızca
 * anlatım dürüst olur.
 *
 * Etiket ve ikon `resolveDraftSendIntent` üzerinden gelir; kapalı haptaki gönder
 * düğmesi de aynı yardımcıyı kullanır, böylece iki düğme ayrışamaz.
 */
export function DraftSendButton({
  autoSend,
  onSend,
  feedback,
  totalItems,
  isSubmitting
}: DraftSendButtonProps) {
  const { t } = useTranslation()
  const intent = resolveDraftSendIntent({ autoSend, feedback, isSubmitting })
  const label = t(DRAFT_SEND_INTENT_KEYS[intent])
  const isDisabled = isSubmitting || totalItems === 0

  const SendIcon = intent === 'sending' ? Loader2 : intent === 'retry' ? RotateCcw : Send

  return (
    // `@container` dar PDF panelinde metni gizleyip ikon butonuna iner;
    // erişilebilir ad korunur, gönderim her genişlikte ulaşılabilir kalır.
    <WithTooltip label={label}>
      <Button
        type="button"
        onClick={onSend}
        disabled={isDisabled}
        size="sm"
        // `@max-[380px]` etiketi gizlediğinde düğmenin erişilebilir adı metinden
        // gelmezdi; `aria-label` adı her genişlikte korur.
        aria-label={label}
        data-testid="ai-draft-send"
        className={cn(
          'text-ql-12 h-8 shrink-0 gap-1.5 rounded-lg px-3 font-semibold @max-[380px]:px-2.5',
          // Devre dışıyken yarı saydam birincil blok kalmaz: dolu bir `muted`
          // yüzey + okunur metin. Tüm düğmeyi `opacity` ile soldurmak koyu temada
          // ıslak gri bir leke gibi okunuyordu.
          isDisabled && 'bg-muted text-muted-foreground hover:bg-muted opacity-100'
        )}
      >
        <SendIcon className={cn('size-3.5', intent === 'sending' && 'animate-spin')} aria-hidden />
        <span className="@max-[380px]:hidden">{label}</span>
      </Button>
    </WithTooltip>
  )
}

export default memo(DraftSendControls)
