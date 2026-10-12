import type { QuickPresetKey } from '@features/ai'
import { usePrompts, useQuickAiPresets } from '@features/ai'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@app/components/ui/select'
import { cn } from '@shared/lib/uiUtils'

import { Check, FileText, Zap } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface DraftPromptSectionProps {
  /** Seçili hızlı işlemin anahtarı (yoksa `null`). */
  quickActionKey: QuickPresetKey | null
  onQuickActionChange: (key: QuickPresetKey | null) => void
}

/** Radix `Select` boş string değerini "seçim yok" sayar; ayrı bir sentinel kullanılır. */
const NONE_VALUE = '__none__'

/**
 * İki seçicinin paylaştığı tek tetikleyici ölçüsü.
 *
 * `SelectTrigger` zaten `w-fit` + `whitespace-nowrap` + `line-clamp-1` ile
 * içeriğe göre boyutlanır; burada yalnızca `py` sıfırlanarak araç satırındaki
 * 32px yükseklikle hizalanır ve `max-w` ile dar panelde taşma engellenir.
 */
const TRIGGER_CLASS =
  'border-border/70 bg-transparent hover:bg-muted/50 h-8 max-w-full gap-1.5 rounded-lg px-2 text-ql-12 font-medium shadow-none'

/**
 * Kayıtlı prompt için kısa, güvenli bir görüntüleme etiketi.
 *
 * Prompt veri modelinde `name` alanı yok ve bu görev için değiştirilmiyor; bu
 * yüzden ilk anlamlı satırdan türetilmiş, kontrollü uzunlukta bir özet üretilir.
 * Tam metin yalnızca menü içinde okunabilir.
 */
function toPromptLabel(text: string): string {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  const flat = (firstLine ?? text).replaceAll(/\s+/g, ' ').trim()
  return flat.length > 28 ? `${flat.slice(0, 28)}…` : flat
}

/**
 * Hızlı işlem + kayıtlı prompt seçicileri — composer'ın araç satırı.
 *
 * Bunlar artık paneli boydan boya kaplayan iki form kutusu değil; içeriğe göre
 * kendi genişliğini alan, aynı yükseklikte iki kompakt tetikleyicidir.
 * Uzun metin `truncate` ile kontrollü kısalır, tamamı menüde okunur.
 *
 *  1. **Hızlı işlem** (`useQuickAiPresets`) — bu gönderimin kısa talimatı.
 *     Not alanına yazılmaz; ayrı state'te tutulur ve yalnızca gönderim
 *     sırasında `composeDraftInstruction` ile talimata dönüşür.
 *  2. **Kayıtlı prompt** (`usePrompts`) — kullanıcının şablonu. Seçim buradan
 *     okunur, metni gönderimde **pipeline tarafından bir kez** eklenir.
 *
 * Kullanıcı ikisini birlikte seçebilir; ikisi sessizce birbirini geçersiz
 * kılmaz, ikisi de kompozisyonda ayrı parçalar olarak sırayla birleşir.
 */
function DraftPromptSection({ quickActionKey, onQuickActionChange }: DraftPromptSectionProps) {
  const { t } = useTranslation()
  const { presets } = useQuickAiPresets()
  const { allPrompts, selectedPromptId, selectPrompt, clearSelection } = usePrompts()

  // `usePrompts.selectPrompt` aynı id'yi tekrar seçmekte toggle uygular (seçimi
  // kaldırır). Kontrollü bir select'te bu, "zaten seçili olanı seç" davranışını
  // istemeden seçimi sildi. Bu yüzden seçim kaldırma açıkça `clearSelection`
  // ile yapılır.
  const handlePromptChange = (value: string) => {
    if (value === NONE_VALUE) clearSelection()
    else selectPrompt(value)
  }

  const selectedPreset = presets.find((preset) => preset.key === quickActionKey)

  return (
    <div className="flex min-w-0 shrink items-center gap-1.5">
      <Select
        value={quickActionKey ?? NONE_VALUE}
        onValueChange={(value) =>
          onQuickActionChange(value === NONE_VALUE ? null : (value as QuickPresetKey))
        }
      >
        <SelectTrigger
          id="ai-draft-quick-action"
          aria-label={t('ai_draft_quick_action_label')}
          size="sm"
          className={cn(
            TRIGGER_CLASS,
            'max-w-[11rem]',
            quickActionKey ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {selectedPreset ? (
            <selectedPreset.icon className="text-primary size-3.5 shrink-0" aria-hidden />
          ) : (
            <Zap className="size-3.5 shrink-0" aria-hidden />
          )}
          <SelectValue placeholder={t('ai_draft_quick_action_placeholder')} />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          sideOffset={4}
          className="max-w-[min(18rem,90vw)] min-w-[11rem]"
        >
          <SelectItem value={NONE_VALUE} className="text-ql-12 text-muted-foreground">
            {t('ai_draft_quick_action_none')}
          </SelectItem>
          {presets.map((preset) => (
            <SelectItem key={preset.key} value={preset.key} className="text-ql-12">
              <span className="flex items-center gap-1.5">
                <preset.icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{preset.label}</span>
                {preset.isCustomized && (
                  <Check className="text-primary size-3 shrink-0" aria-hidden />
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedPromptId ?? NONE_VALUE} onValueChange={handlePromptChange}>
        <SelectTrigger
          id="ai-draft-prompt"
          aria-label={t('ai_draft_prompt_label')}
          size="sm"
          className={cn(TRIGGER_CLASS, 'max-w-[13rem]', selectedPromptId && 'text-foreground')}
        >
          <FileText className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <SelectValue placeholder={t('ai_draft_prompt_placeholder')} />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          sideOffset={4}
          className="max-h-[min(18rem,60vh)] w-[21rem] max-w-[min(24rem,92vw)]"
        >
          <SelectItem value={NONE_VALUE} className="text-ql-12 text-muted-foreground">
            {t('ai_draft_no_prompt')}
          </SelectItem>
          {allPrompts.map((prompt) => (
            <SelectItem key={prompt.id} value={prompt.id} className="text-ql-12">
              {/* Menüde kısa etiket + tam metin; dar dropdown'da iki satırlık
                  kırpılmış prompt gösterilmez. */}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">{toPromptLabel(prompt.text)}</span>
                <span className="text-ql-10 text-muted-foreground line-clamp-2 break-words whitespace-normal">
                  {prompt.text}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default memo(DraftPromptSection)
