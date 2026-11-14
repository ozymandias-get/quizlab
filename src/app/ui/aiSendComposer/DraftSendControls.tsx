import { Switch } from '@app/components/ui/switch'
import { cn } from '@shared/lib/uiUtils'
import { Button, WithTooltip } from '@shared/ui/components/primitives'

import { AlertCircle, Loader2, RotateCcw, Send, TriangleAlert } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DRAFT_SEND_INTENT_KEYS,
  isDraftSendIntentActionable,
  resolveDraftSendIntent
} from './draftSendIntent'
import type { SendFeedback } from './types'

interface DraftSendControlsProps {
  autoSend: boolean
  onToggleAutoSend: () => void
  /** "Tekrar dene" — yalnızca güvenle tekrarlanabilen hatalarda etkindir. */
  onRetry: () => void
  /** Kısmi uygulanmış gönderimde durumu dinleme (güvenli manuel devam). */
  onDismiss: () => void
  feedback: SendFeedback
  isSubmitting: boolean
  isResendSafe: boolean
  /** Bildirim kapatıldıysa yalnızca görünürlük gizlenir; gönderim kilidi kalır. */
  showOutcome?: boolean
}

/**
 * Alt durum satırı — otomatik gönderim anahtarı + sonuç.
 *
 * Ana eylem burada değildir; gönderim butonu composer'ın araç satırının sağ
 * ucundadır. Bu satır yalnızca "hangi modda olduğumuz" ve "ne oldu" sorusunu
 * yanıtlar, bu yüzden tek satırda kalır.
 *
 * Durum modeli bilinçli olarak ayrıdır:
 *  - `incomplete` → içerik hedefe ulaştı, sonraki adım başarısız oldu. Otomatik
 *                   tekrar **yapılmaz**; kullanıcı bilgilendirilir ve durumu
 *                   kapatabilir. Mükerrer mesajın önü buradadır.
 *  - teslim edilen / hazırlanan içerik → **görünmez**. Kuyruk boşaldığı için
 *    sonuç zaten kendini gösterir; "Gönderildi" yazısı yalnızca tekrar olurdu.
 *
 * `role="status"` + `aria-live="polite"` sonuç metnini ekran okuyucuya da
 * duyurur; yalnızca renk/tooltip ile anlatmak yeterli değildir.
 */
function DraftSendControls({
  autoSend,
  onToggleAutoSend,
  onRetry,
  onDismiss,
  feedback,
  isSubmitting,
  isResendSafe,
  showOutcome = true
}: DraftSendControlsProps) {
  const { t } = useTranslation()

  const isIncomplete = showOutcome && feedback === 'incomplete'
  const canRetry = showOutcome && feedback === 'error' && isResendSafe

  // Alt satır yalnızca **kısa durum** taşır; uzun hata metni içerik alanındaki
  // tek `role="alert"` yüzeyinde kalır (görsel tekrar ve satır büyümesi yok).
  const statusLabel = !showOutcome
    ? null
    : feedback === 'sending'
      ? t('sending_to_ai')
      : isIncomplete
        ? t('ai_send_awaiting_submit')
        : feedback === 'error'
          ? t('ai_send_error')
          : null

  const StatusIcon = feedback === 'sending' ? Loader2 : isIncomplete ? TriangleAlert : AlertCircle

  const statusTone = isIncomplete
    ? 'text-amber-400'
    : feedback === 'error'
      ? 'text-destructive'
      : feedback === 'sending'
        ? 'text-foreground'
        : 'text-muted-foreground'

  return (
    <div className="flex min-h-8 shrink-0 items-center gap-2 rounded-b-2xl border-t border-white/[0.07] bg-zinc-950/40 px-3.5 py-1.5">
      <label
        className={cn(
          'flex shrink-0 items-center gap-2 select-none',
          isSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        )}
      >
        <Switch
          size="sm"
          checked={!!autoSend}
          onCheckedChange={onToggleAutoSend}
          disabled={isSubmitting}
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
          style={
            autoSend
              ? {
                  color: 'var(--selection-color-source, oklch(var(--primary)))',
                  backgroundColor:
                    'color-mix(in oklch, var(--selection-color-source, oklch(var(--primary))) 14%, transparent)'
                }
              : undefined
          }
          className={cn(
            'text-ql-10 shrink-0 rounded-full px-1.5 py-0.5 font-semibold transition-colors @max-[24rem]:hidden',
            autoSend ? 'bg-primary/10 text-primary' : 'text-muted-foreground bg-zinc-900/60'
          )}
        >
          {autoSend ? t('ai_send_auto_on') : t('ai_send_auto_off')}
        </span>
      </label>

      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/70 text-ql-11 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 transition-colors focus-visible:ring-1 focus-visible:outline-none"
        >
          <RotateCcw className="size-3 shrink-0" aria-hidden />
          {t('ai_send_retry')}
        </button>
      )}

      {/* Kısmi uygulama: tekrar göndermek mükerrer mesaj üretir. Bunun yerine
          durumu kapatma eylemi sunulur; taslak hiçbir şekilde silinmez. */}
      {isIncomplete && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/70 text-ql-11 shrink-0 rounded-full px-2 py-0.5 transition-colors focus-visible:ring-1 focus-visible:outline-none"
        >
          {t('ai_send_dismiss')}
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
          <span
            className={cn('text-ql-11 max-w-[12rem] truncate font-medium', statusTone)}
            title={statusLabel}
          >
            {statusLabel}
          </span>
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
 * `awaiting` (kısmi uygulama) durumunda düğme "Sitede gönderin" der ve devre
 * dışıdır: o anda yapabileceği güvenli bir eylem yoktur ve "tekrar gönder"
 * hedefte ikinci bir kopya bırakırdı.
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
  const isDisabled = isSubmitting || totalItems === 0 || !isDraftSendIntentActionable(intent)

  const SendIcon = intent === 'sending' ? Loader2 : intent === 'retry' ? RotateCcw : Send

  return (
    // `@container` dar PDF panelinde metni gizleyip ikon butonuna iner;
    // erişilebilir ad korunur, gönderim her genişlikte ulaşılabilir kalır.
    // Eşik 380px değil **330px**: varsayılan 394px dock'ta etiket görünür kalsın
    // (gerçek Electron ölçümü — 380px eşiğinde "AI'ye Gönder" hiç görünmüyordu).
    <WithTooltip label={label}>
      <Button
        type="button"
        onClick={onSend}
        disabled={isDisabled}
        size="sm"
        // `@max-[330px]` etiketi gizlediğinde düğmenin erişilebilir adı metinden
        // gelmezdi; `aria-label` adı her genişlikte korur.
        aria-label={label}
        data-testid="ai-draft-send"
        className={cn(
          'text-ql-11 h-7 min-w-[120px] shrink-0 justify-center gap-1.5 rounded-full px-3 font-semibold transition-all @max-[330px]:min-w-0 @max-[330px]:px-2.5',
          isDisabled
            ? 'border-0 bg-zinc-800 text-zinc-400 opacity-100 shadow-none hover:bg-zinc-800'
            : 'bg-zinc-100 text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.12)] hover:bg-white hover:shadow-[0_0_24px_rgba(255,255,255,0.18)]'
        )}
      >
        <SendIcon className={cn('size-3.5', intent === 'sending' && 'animate-spin')} aria-hidden />
        <span className="@max-[330px]:hidden">{label}</span>
      </Button>
    </WithTooltip>
  )
}

export default memo(DraftSendControls)
