import { useQuickAiPresets } from '@features/ai'

import { useLocalStorage } from '@shared/hooks'
import { cn } from '@shared/lib/uiUtils'
import { IconButton } from '@shared/ui/components/primitives'

import { ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { composeDraftInstruction } from './aiSendComposer/composeDraftInstruction'
import DraftDockBar from './aiSendComposer/DraftDockBar'
import DraftItemChips from './aiSendComposer/DraftItemChips'
import DraftNoteField from './aiSendComposer/DraftNoteField'
import DraftOverflowMenu from './aiSendComposer/DraftOverflowMenu'
import DraftPromptSection from './aiSendComposer/DraftPromptSection'
import DraftSendControls, { DraftSendButton } from './aiSendComposer/DraftSendControls'
import type { AiSendComposerProps } from './aiSendComposer/types'
import { useAiSendComposerState } from './aiSendComposer/useAiSendComposerState'
import { useComposerSendAction } from './aiSendComposer/useComposerSendAction'

const DRAFT_OPEN_PREF_KEY = 'aiDraftOpen'

/**
 * Dock'un DOM'unun dışında ama ona ait sayılan yüzeyler.
 *
 * Radix, açılır listeleri / ipuçlarını / diyalogları `<body>` altına portal
 * eder. Tıklama-dışı kapatma bunları "dışarı" saymasın diye tanımlanır.
 */
const PORTAL_SURFACE_SELECTOR =
  '[role="listbox"], [role="dialog"], [role="alertdialog"], [role="tooltip"], [role="menu"]'

interface ExtendedComposerProps extends AiSendComposerProps {
  onRemoveItem?: (id: string) => void
  /**
   * `inline` — PDF sahnesindeki yuvaya portal ile basıldığında: kart, PDF
   *   yüzeyinin üstüne binen yüzen bir katmandır, akışa girmez.
   * `floating` — PDF paneli yokken kullanılan yedek konum (viewport'a sabit).
   */
  placement?: 'inline' | 'floating'
}

/**
 * AI Draft Dock — PDF okuyucu üzerinde yüzen taslak çalışma alanı.
 *
 * Yerleşim: kart, PDF görüntüleme alanının üzerine **binen** mutlak konumlu bir
 * yüzdür. PDF'in ölçüsü hiç değişmediği için dock'u açmak sayfayı kaydırmaz,
 * yeniden refit tetiklemez, zoom'u sıfırlamaz — görüntüleme hiçbir şekilde
 * yeniden mount edilmez. Kart kendi içinde cam yüzey (blur + gölge) taşır ve
 * PDF ile arasında hava bırakır; kapalıyken bir hap şeklinde küçülür.
 *
 * Sorumluluklar `aiSendComposer/` altındaki modüllere ayrılmıştır:
 * DraftDockBar (kapalı hap), DraftItemChips (içerikler),
 * DraftPromptSection (hızlı işlem + kayıtlı prompt), DraftNoteField (ek talimat),
 * DraftSendControls (gönderim), DraftOverflowMenu (ikincil işlemler).
 * Bu dosya yalnızca durum ve besteleri kurar.
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
  const [isStoredOpen, setStoredOpen] = useLocalStorage<boolean>(DRAFT_OPEN_PREF_KEY, false)
  const [isOpen, setIsOpen] = useState(isStoredOpen)
  /** Tıklama-dışı kapatmanın "içeride miyim" kontrolü için kök düğüm. */
  const dockRef = useRef<HTMLDivElement>(null)

  const {
    noteText,
    setNoteText,
    isSubmitting,
    setIsSubmitting,
    quickActionKey,
    selectQuickAction,
    clearNote
  } = useAiSendComposerState()

  const { presets } = useQuickAiPresets()
  const quickActionValue = useMemo(
    () => presets.find((preset) => preset.key === quickActionKey)?.value,
    [presets, quickActionKey]
  )

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
        // Gönderim sırasında dock otomatik kapanmaz: ilerleme ve hata görünür
        // kalmalı, yükseklik zıplamamalı. Yalnızca açık talebini uygula.
        if (next === false) return
        setIsOpen(next)
        setStoredOpen(next)
      },
      setStoredExpanded: (v) => {
        if (v === false) return
        setStoredOpen(v)
      }
    })

  const handleToggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      setStoredOpen(next)
      return next
    })
  }, [setStoredOpen])

  /**
   * Kapatma — **yalnızca görünümü** kapatır.
   *
   * Kuyruk, ek not ve hızlı işlem seçimi dokunulmadan kalır; taslak bir defter
   * notu gibi kapatılıp yeniden açılabilir bir şeydir. Tıklama-dışı davranışı
   * da aynı yolu izler (aşağıdaki efekt), böylece "dışarı tıkladım" ile "ok
   * okuna bastım" aynı sonucu verir ve `isOpen` ile kayıtlı tercih ayrışmaz.
   */
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setStoredOpen(false)
  }, [setStoredOpen])

  /**
   * Tıklama-dışı kapatma.
   *
   * `pointerdown` + `capture` seçilir: Radix'in kendi "dışarı tıklandı"
   * işleyicileri de yakalama fazında çalışır ve bu sıralama iki yüzeyin de
   * aynı tıklamayı doğru okumasını sağlar.
   *
   * Kritik ayrım: **portaldaki yüzeyler dock'un parçası sayılır.** Radix
   * seçim listesi, araç ipucu ve onay diyaloğu dock'un DOM'unun dışında,
   * `<body>` altında render edilir. Bunlar `contains()` dışında kalırdı;
   * sayılmadıkları için "hızlı işlem" listesinden bir komut seçerken dock
   * kendi altından kapanırdı.
   */
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target || dockRef.current?.contains(target)) return
      if (target.closest(PORTAL_SURFACE_SELECTOR)) return
      handleClose()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [isOpen, handleClose])

  /**
   * Tam taslak temizleme sözleşmesi:
   *  - Kuyruk mevcut `onClearAll` üzerinden temizlenir (görsel blob'ları dahil).
   *  - Ek not ve seçili hızlı işlem SIFIRLANIR: ikisi de bu taslağa aittir.
   *  - Global kayıtlı prompt seçimi KORUNUR; o kullanıcının genel tercihidir ve
   *    `usePrompts` deposunda yaşar, taslakla ilgisi yoktur.
   */
  const handleClearAll = useCallback(() => {
    clearNote()
    selectQuickAction(null)
    setSendFeedback('idle')
    setLastError(null)
    onClearAllRef.current()
  }, [clearNote, selectQuickAction, setSendFeedback, setLastError])

  // Gönderim anında tek bir deterministik talimat metni kurulur:
  // hızlı işlem talimatı + kullanıcının ek notu. Kayıtlı prompt burada değil —
  // pipeline onu kendisi ekler.
  const handleSubmit = useCallback(() => {
    const instruction = composeDraftInstruction({
      quickActionText: quickActionValue,
      noteText
    })
    void handleSend(instruction !== undefined ? { noteText: instruction } : undefined)
  }, [handleSend, noteText, quickActionValue])

  const isSending = sendFeedback === 'sending' || isSubmitting

  // Dock kapalıyken de görünür olması gereken kısa durum.
  const barStatus = isSending
    ? { label: t('sending_to_ai'), tone: 'neutral' as const }
    : sendFeedback === 'success'
      ? { label: t('ai_send_sent'), tone: 'success' as const }
      : sendFeedback === 'staged'
        ? { label: t('ai_send_staged'), tone: 'neutral' as const }
        : sendFeedback === 'error'
          ? { label: t('ai_send_error'), tone: 'error' as const }
          : null

  return (
    <div
      ref={dockRef}
      className={cn(
        'pointer-events-none flex w-full',
        placement === 'inline' ? 'justify-center' : 'z-modal fixed bottom-4 left-4 w-[360px]'
      )}
      data-testid="ai-draft-root"
      data-placement={placement}
    >
      {/* Tek `pointer-events-auto` sınırı kartın kendisidir: kartın dışında kalan
          PDF alanı pan sürükleme / metin seçimi yakalımaya devam eder.
          `@container` dar PDF panelinde alt kontrollerin kademeli sadeleşmesini
          sağlar (bkz. `DraftSendButton`). */}
      <div
        className="@container pointer-events-auto flex w-full max-w-[46rem] flex-col"
        data-testid="ai-draft-dock"
      >
        {!isOpen && (
          <DraftDockBar
            itemCount={totalItems}
            autoSend={autoSend}
            isSending={isSending}
            feedback={sendFeedback}
            isOpen={isOpen}
            onToggle={handleToggleOpen}
            onSend={handleSubmit}
            statusLabel={barStatus?.label}
            statusTone={barStatus?.tone}
          />
        )}

        {isOpen && (
          <section
            id="ai-draft-dock-body"
            aria-label={t('ai_draft_badge')}
            data-testid="ai-draft-panel"
            className="border-border/70 bg-popover/92 shadow-ambient-lg animate-in fade-in slide-in-from-bottom-2 motion-slow flex max-h-[min(44vh,19rem)] min-h-0 flex-col rounded-2xl border backdrop-blur-xl"
          >
            {/* Başlık kendi satırını paylaşan bir "zemin" değil, kartın kimliğidir:
                ikon rozeti + ad + sayı rozeti tek hizada okunur. `relative z-[2]`
                açılan taşma menüsünü, alttaki kaydırılabilir gövdenin üstünde tutar. */}
            <header className="border-border/50 relative z-[2] flex h-11 shrink-0 items-center gap-2 border-b px-3">
              <span
                className="border-primary/20 bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full border"
                aria-hidden
              >
                {isSending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
              </span>
              <p className="text-ql-12 shrink-0 font-semibold">{t('ai_draft_badge')}</p>
              {totalItems > 0 && (
                <span className="bg-muted text-muted-foreground text-ql-10 shrink-0 rounded-full px-1.5 font-semibold tabular-nums">
                  {t('ai_draft_content_count', { count: totalItems })}
                </span>
              )}
              <span className="flex-1" />
              <DraftOverflowMenu onClearAll={handleClearAll} totalItems={totalItems} />
              <IconButton
                type="button"
                variant="ghost"
                size="compact"
                onClick={handleToggleOpen}
                aria-label={t('ai_draft_close')}
                aria-expanded
                className="text-muted-foreground hover:bg-muted hover:text-foreground size-6"
              >
                <ChevronDown className="size-3.5" aria-hidden />
              </IconButton>
            </header>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
              <DraftItemChips items={items} onRemoveItem={onRemoveItem} />

              {sendFeedback === 'error' && lastError && (
                <div className="border-destructive/25 bg-destructive/8 mx-3 mb-2 rounded-lg border px-2.5 py-1.5">
                  <p className="text-destructive text-ql-11 leading-snug font-medium">
                    {lastError}
                  </p>
                </div>
              )}

              {/* Birleşik composer yüzeyi: tek ince sınır, iç içe kutu yok.
                  Üstte ek talimat, altında araç satırı, sağda ana eylem. */}
              <div
                data-testid="ai-draft-composer"
                className="border-border/60 bg-background/60 focus-within:border-primary/40 focus-within:bg-background @container mx-3 mb-2 overflow-hidden rounded-xl border transition-colors"
              >
                <DraftNoteField
                  value={noteText}
                  onChange={setNoteText}
                  onSubmit={handleSubmit}
                  disabled={isSending}
                />

                {/* Araç satırı textarea'dan sert bir çizgiyle ayrılmaz; aynı
                    yüzeyin alt şeridi olarak okunur. */}
                <div className="flex flex-wrap items-center gap-1.5 px-2 pt-0.5 pb-2">
                  <DraftPromptSection
                    quickActionKey={quickActionKey}
                    onQuickActionChange={selectQuickAction}
                  />
                  <span className="flex-1" />
                  <DraftSendButton
                    autoSend={autoSend}
                    onSend={handleSubmit}
                    feedback={sendFeedback}
                    totalItems={totalItems}
                    isSubmitting={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <DraftSendControls
              autoSend={autoSend}
              onToggleAutoSend={() => onToggleAutoSend?.()}
              onRetry={handleRetry}
              feedback={sendFeedback}
              lastError={lastError}
              isSubmitting={isSubmitting}
            />
          </section>
        )}
      </div>
    </div>
  )
}

export default memo(AiSendComposer)
