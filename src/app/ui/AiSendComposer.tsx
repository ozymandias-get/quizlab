import { usePrompts } from '@features/ai'

import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { Textarea } from '@app/components/ui/textarea'
import { formatSourcePageLabel } from '@app/providers/ai/pdfSource'
import { useConfirmDialog, useLocalStorage } from '@shared/hooks'
import { DURATION } from '@shared/lib/motion'
import { cn } from '@shared/lib/uiUtils'
import { Button, IconButton, WithTooltip } from '@shared/ui/components/primitives'

import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Type,
  X
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import PromptPresets from './aiSendComposer/PromptPresets'
import type { AiSendComposerProps } from './aiSendComposer/types'
import { useAiSendComposerState } from './aiSendComposer/useAiSendComposerState'
import { useComposerSendAction } from './aiSendComposer/useComposerSendAction'

const DRAFT_OPEN_PREF_KEY = 'aiDraftOpen'

interface ExtendedComposerProps extends AiSendComposerProps {
  onRemoveItem?: (id: string) => void
  /**
   * `inline` — PDF panelindeki yuvaya basıldığında (normal yerleşim).
   * `floating` — PDF paneli yokken kullanılan yedek konum.
   */
  placement?: 'inline' | 'floating'
}

/** Küçük "tür rozeti": metin mi görsel mi — ikon + etiket, tek satırda. */
function KindChip({
  icon: Icon,
  label,
  count
}: {
  icon: LucideIcon
  label: string
  count: number
}) {
  if (count <= 0) return null
  return (
    <span className="bg-muted text-muted-foreground text-ql-11 flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium">
      <Icon className="size-3" aria-hidden />
      {label}
      <span className="text-foreground tabular-nums">{count}</span>
    </span>
  )
}

/**
 * AI Taslağı — kararlı, kompakt, modern.
 *
 * - Sürekli açık büyük panel yok; sağ altta küçük "AI Taslağı · N" kontrolü.
 * - Tıklayınca açılır; sürükle-bırak / yeniden boyutlandırma yok, zıplama yok.
 * - Görsel önizleme galerisi yok; kompakt satırlar (tür ikonu + sayfa bilgisi).
 * - Prompt seçimi (kayıtlı promptlar), ek talimat/not, otomatik gönderme anahtarı,
 *   Gönder / Temizle / öğe bazında kaldırma korunur.
 * - Panel kapanınca taslak kaybolmaz; açıkça temizlenmedikçe silinmez.
 * - Her içerik eklendiğinde kendiliğinden açılmaz.
 *
 * Hareket: yalnızca açılış/kapanış opaklığı ve 8px yukarı geçişi
 * (`DURATION.normal`), `prefers-reduced-motion` altında tamamen düşer. Panel
 * açıkken not yazıldıkça yükseklik değişmez (`field-sizing-fixed` + sabit px).
 */
function AiSendComposer({
  items,
  onClearAll,
  onRemoveItem,
  onSend,
  autoSend = false,
  onToggleAutoSend,
  placement = 'inline'
}: ExtendedComposerProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [isStoredOpen, setStoredOpen] = useLocalStorage<boolean>(DRAFT_OPEN_PREF_KEY, false)
  const [isOpen, setIsOpen] = useState(isStoredOpen)

  const { noteText, setNoteText, isSubmitting, setIsSubmitting, clearNote } =
    useAiSendComposerState()

  const { allPrompts, selectedPromptId, selectPrompt } = usePrompts()

  const itemsLengthRef = useRef(items.length)
  itemsLengthRef.current = items.length
  const onClearAllRef = useRef(onClearAll)
  onClearAllRef.current = onClearAll

  const { textCount, imageCount } = useMemo(() => {
    let text = 0
    let image = 0
    for (const draft of items) {
      if (draft.type === 'text') text += 1
      else image += 1
    }
    return { textCount: text, imageCount: image }
  }, [items])
  const totalItems = textCount + imageCount

  const { sendFeedback, setSendFeedback, lastError, setLastError, handleSend, handleRetry } =
    useComposerSendAction({
      isSubmitting,
      setIsSubmitting,
      onSend,
      noteText,
      effectiveAutoSend: autoSend,
      setIsExpanded: (v) => {
        const next = typeof v === 'function' ? (v as (p: boolean) => boolean)(isOpen) : v
        // Gönderim sırasında paneli otomatik kapatma: ilerleme ve hata panelde
        // görünsün, yükseklik zıplamasın. Yalnızca açık talebini uygula.
        if (next === false) return
        setIsOpen(next)
        setStoredOpen(next)
      },
      setStoredExpanded: (v) => {
        if (v === false) return
        setStoredOpen(v)
      }
    })

  const { confirm, props: confirmProps } = useConfirmDialog()

  const handleToggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      setStoredOpen(next)
      return next
    })
  }, [setStoredOpen])

  const handleClearAll = useCallback(async () => {
    if (itemsLengthRef.current > 1) {
      if (!(await confirm({ title: t('ai_send_clear_confirm'), variant: 'destructive' }))) return
    }
    clearNote()
    setSendFeedback('idle')
    setLastError(null)
    onClearAllRef.current()
  }, [clearNote, t, confirm, setSendFeedback, setLastError])

  // Hazır komutlar mevcut notun sonuna eklenir (mevcut prompt sistemi korunur).
  const handlePresetAppend = useCallback(
    (preset: string) => {
      const current = noteText
      if (current.trim()) setNoteText(current + '\n' + preset)
      else setNoteText(preset)
    },
    [noteText, setNoteText]
  )

  const isSending = sendFeedback === 'sending' || isSubmitting

  const statusLabel =
    sendFeedback === 'sending'
      ? t('sending_to_ai')
      : sendFeedback === 'success'
        ? t('ai_send_sent')
        : sendFeedback === 'error'
          ? (lastError ?? t('ai_send_error'))
          : totalItems > 0
            ? t('ai_send_ready')
            : ''

  const StatusIcon =
    sendFeedback === 'sending'
      ? Loader2
      : sendFeedback === 'success'
        ? CheckCircle2
        : sendFeedback === 'error'
          ? AlertCircle
          : null

  return (
    <>
      <div
        className={cn(
          'pointer-events-none flex gap-2',
          placement === 'inline'
            ? 'flex-col items-end'
            : 'z-modal fixed bottom-4 left-4 flex-col items-start'
        )}
        data-testid="ai-draft-root"
        data-placement={placement}
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="ai-draft-panel"
              role="dialog"
              aria-label={t('ai_send_panel_title')}
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
              {/* Başlık: kimlik + tür rozetleri */}
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
                    <KindChip icon={Type} label={t('ai_draft_item_text')} count={textCount} />
                    <KindChip
                      icon={ImageIcon}
                      label={t('ai_draft_item_image')}
                      count={imageCount}
                    />
                  </div>
                </div>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="compact"
                  onClick={handleToggleOpen}
                  aria-label={t('ai_draft_close')}
                  aria-expanded={isOpen}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground -mt-0.5 shrink-0"
                >
                  <X className="size-4" aria-hidden />
                </IconButton>
              </header>

              {/* İçerik listesi: kompakt satırlar, galeri yok */}
              <div
                className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2"
                style={{ maxHeight: 208 }}
              >
                {totalItems === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                    <span
                      className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-xl"
                      aria-hidden
                    >
                      <Sparkles className="size-4" />
                    </span>
                    <p className="text-muted-foreground text-ql-11 leading-relaxed">
                      {t('ai_draft_empty')}
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1" aria-label={t('ai_send_panel_title')}>
                    {items.map((item) => {
                      const pageLabel = item.source
                        ? formatSourcePageLabel(item.source)
                        : item.type === 'image' && item.page
                          ? `Sayfa ${item.page}`
                          : null
                      const kindLabel =
                        item.type === 'text' ? t('ai_draft_item_text') : t('ai_draft_item_image')
                      const docName = item.source?.docName
                      return (
                        <li
                          key={item.id}
                          data-testid="ai-draft-item"
                          className="group border-border/50 bg-muted/40 hover:border-border hover:bg-muted/70 focus-within:border-border flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors"
                        >
                          <span
                            className="bg-background text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md"
                            aria-hidden
                          >
                            {item.type === 'text' ? (
                              <Type className="size-3.5" />
                            ) : (
                              <ImageIcon className="size-3.5" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-1.5">
                              <span className="text-ql-12 truncate font-medium">{kindLabel}</span>
                              {pageLabel && (
                                <span className="text-muted-foreground text-ql-11 shrink-0 tabular-nums">
                                  · {pageLabel}
                                </span>
                              )}
                            </span>
                            {docName && (
                              <span className="text-muted-foreground text-ql-11 block truncate">
                                {docName}
                              </span>
                            )}
                          </span>
                          {onRemoveItem && (
                            <IconButton
                              type="button"
                              variant="ghost"
                              size="compact"
                              onClick={() => onRemoveItem(item.id)}
                              aria-label={t('ai_send_remove_item')}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 opacity-70 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <X className="size-3.5" aria-hidden />
                            </IconButton>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {sendFeedback === 'error' && lastError && (
                <div className="border-destructive/25 bg-destructive/8 mx-3.5 mb-2 rounded-xl border px-2.5 py-2">
                  <p className="text-destructive text-ql-11 leading-snug font-medium">
                    {lastError}
                  </p>
                </div>
              )}

              {/* Kayıtlı prompt seçimi */}
              <div className="border-border/70 border-t px-3.5 pt-3 pb-2">
                <label
                  htmlFor="ai-draft-prompt"
                  className="text-muted-foreground text-ql-10 tracking-ql-label mb-1.5 block font-semibold uppercase"
                >
                  {t('ai_draft_prompt_label')}
                </label>
                <div className="relative">
                  <select
                    id="ai-draft-prompt"
                    value={selectedPromptId ?? ''}
                    onChange={(e) => selectPrompt(e.target.value)}
                    className="border-border/80 bg-background/50 text-ql-12 focus-visible:ring-foreground/15 motion-normal h-8 w-full appearance-none rounded-lg border py-0 pr-8 pl-2.5 font-medium transition-colors outline-none focus-visible:border-neutral-400 focus-visible:ring-1 dark:focus-visible:border-neutral-500"
                  >
                    <option value="">{t('ai_draft_no_prompt')}</option>
                    {allPrompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.text.slice(0, 60)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2"
                    aria-hidden
                  />
                </div>
                <div className="mt-2">
                  <PromptPresets onSelect={handlePresetAppend} />
                </div>
              </div>

              {/* Ek talimat: sabit yükseklik, panel zıplamaz */}
              <div className="px-3.5 pt-1 pb-3">
                <label
                  htmlFor="ai-draft-note"
                  className="text-muted-foreground text-ql-10 tracking-ql-label mb-1.5 block font-semibold uppercase"
                >
                  {t('ai_draft_note_label')}
                </label>
                <Textarea
                  id="ai-draft-note"
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                  placeholder={t('ai_send_text_placeholder')}
                  className="text-ql-12 field-sizing-fixed h-[68px] max-h-[68px] min-h-[68px] resize-none"
                />
              </div>

              {/* Alt bar: otomatik gönderme + temizle / durum + gönder */}
              <footer className="border-border/70 bg-muted/25 flex flex-col gap-2 border-t px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onToggleAutoSend}
                    aria-pressed={!!autoSend}
                    aria-label={autoSend ? t('auto_send_on') : t('auto_send_off')}
                    className={cn(
                      'motion-normal focus-visible:ring-ring/40 text-ql-11 flex h-7 items-center gap-1.5 rounded-lg border px-2 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      autoSend
                        ? 'border-ring/45 bg-accent text-foreground'
                        : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Sparkles className="size-3.5" aria-hidden />
                    {t('ai_send_mode_auto')}
                    <span
                      aria-hidden
                      className={cn(
                        'size-1.5 rounded-full transition-colors',
                        autoSend ? 'bg-emerald-500' : 'bg-muted-foreground/45'
                      )}
                    />
                  </button>

                  <WithTooltip label={t('ai_send_clear_all')}>
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="compact"
                      onClick={handleClearAll}
                      aria-label={t('ai_send_clear_all')}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </IconButton>
                  </WithTooltip>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5" role="status">
                    {StatusIcon && (
                      <StatusIcon
                        className={cn(
                          'size-3.5 shrink-0',
                          sendFeedback === 'sending' && 'text-primary animate-spin',
                          sendFeedback === 'success' && 'text-emerald-600 dark:text-emerald-400',
                          sendFeedback === 'error' && 'text-destructive'
                        )}
                        aria-hidden
                      />
                    )}
                    <span
                      className={cn(
                        'text-ql-11 truncate font-medium',
                        sendFeedback === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : sendFeedback === 'error'
                            ? 'text-destructive'
                            : sendFeedback === 'sending'
                              ? 'text-primary'
                              : 'text-muted-foreground'
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {sendFeedback === 'error' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRetry}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground gap-1"
                      >
                        <RotateCcw className="size-3.5" aria-hidden />
                        {t('ai_send_retry')}
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={isSubmitting || totalItems === 0}
                      className="text-ql-12 h-8 gap-1.5 px-3 font-semibold"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          {t('sending_to_ai')}
                        </>
                      ) : sendFeedback === 'error' ? (
                        <>
                          <RotateCcw className="size-3.5" aria-hidden />
                          {t('ai_send_retry_send')}
                        </>
                      ) : (
                        <>
                          <Send className="size-3.5" aria-hidden />
                          {t('send_to_ai')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Küçük kontrol: her zaman erişilebilir, PDF'yi kapatmaz */}
        <Button
          type="button"
          variant="outline"
          onClick={handleToggleOpen}
          aria-expanded={isOpen}
          aria-label={isOpen ? t('ai_draft_close') : t('ai_draft_open')}
          data-testid="ai-draft-badge"
          className="border-border bg-card/95 text-foreground shadow-ambient-lg hover:bg-accent/40 pointer-events-auto h-10 max-w-full gap-2 rounded-full pr-3 pl-2 backdrop-blur-md"
        >
          <span
            className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full"
            aria-hidden
          >
            {isSending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" strokeWidth={2} />
            )}
          </span>
          <span className="text-ql-12 font-semibold whitespace-nowrap">{t('ai_draft_badge')}</span>
          {totalItems > 0 && (
            <span className="bg-primary text-primary-foreground text-ql-11 min-w-5 rounded-full px-1.5 text-center font-semibold tabular-nums">
              {totalItems}
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          ) : (
            <ChevronUp className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          )}
        </Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </>
  )
}

export default memo(AiSendComposer)
