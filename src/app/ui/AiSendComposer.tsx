import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { useConfirmDialog, useLocalStorage } from '@shared/hooks'
import { cn } from '@shared/lib/uiUtils'

import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import DraftItemList from './aiSendComposer/DraftItemList'
import DraftNoteField from './aiSendComposer/DraftNoteField'
import DraftPanel, { DraftPanelHeader } from './aiSendComposer/DraftPanel'
import DraftPromptSection from './aiSendComposer/DraftPromptSection'
import DraftSendControls from './aiSendComposer/DraftSendControls'
import DraftTrigger from './aiSendComposer/DraftTrigger'
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
 * Sorumluluklar `aiSendComposer/` altındaki modüllere ayrılmıştır: DraftTrigger
 * (küçük kontrol), DraftPanel (yerleşim/hareket), DraftItemList (satırlar),
 * DraftPromptSection (promptlar), DraftNoteField (ek talimat),
 * DraftSendControls (gönderim kontrolü). Bu dosya yalnızca durum ve besteler.
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

  const { noteText, setNoteText, isSubmitting, setIsSubmitting, clearNote } =
    useAiSendComposerState()

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
        <DraftPanel isOpen={isOpen} placement={placement}>
          <DraftPanelHeader
            textCount={textCount}
            imageCount={imageCount}
            onClose={handleToggleOpen}
          />

          <DraftItemList items={items} onRemoveItem={onRemoveItem} />

          {sendFeedback === 'error' && lastError && (
            <div className="border-destructive/25 bg-destructive/8 mx-3.5 mb-2 rounded-xl border px-2.5 py-2">
              <p className="text-destructive text-ql-11 leading-snug font-medium">{lastError}</p>
            </div>
          )}

          <DraftPromptSection onPresetAppend={handlePresetAppend} />

          <DraftNoteField
            value={noteText}
            onChange={setNoteText}
            onSubmit={() => void handleSend()}
          />

          <DraftSendControls
            autoSend={autoSend}
            onToggleAutoSend={() => onToggleAutoSend?.()}
            onClearAll={() => void handleClearAll()}
            onSend={() => void handleSend()}
            onRetry={handleRetry}
            feedback={sendFeedback}
            lastError={lastError}
            totalItems={totalItems}
            isSubmitting={isSubmitting}
          />
        </DraftPanel>

        {/* Küçük kontrol: her zaman erişilebilir, PDF'yi kapatmaz */}
        <DraftTrigger
          itemCount={totalItems}
          isOpen={isOpen}
          isSending={isSending}
          onToggle={handleToggleOpen}
        />
      </div>
      <ConfirmDialog {...confirmProps} />
    </>
  )
}

export default memo(AiSendComposer)
