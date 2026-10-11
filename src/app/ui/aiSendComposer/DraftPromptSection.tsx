import { usePrompts } from '@features/ai'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@app/components/ui/select'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import PromptPresets from './PromptPresets'

interface DraftPromptSectionProps {
  /** Hazır komutlar mevcut notun sonuna eklenir. */
  onPresetAppend: (preset: string) => void
}

/** Radix `Select` boş string değerini "seçim yok" sayar; ayrı bir sentinel kullanılır. */
const NONE_VALUE = '__none__'

/** Çok satırlı prompt metnini menüde tek satırlık, dengeli bir etikete indirger. */
function toOptionLabel(text: string): string {
  const flat = text.replaceAll(/\s+/g, ' ').trim()
  return flat.length > 68 ? `${flat.slice(0, 68)}…` : flat
}

/**
 * Kayıtlı prompt seçimi + hazır komutlar.
 *
 * Seçim prompt deposundan okunur (`usePrompts`), gönderim anında pipeline
 * tarafından bir kez uygulanır; not alanına dokunmuz.
 */
function DraftPromptSection({ onPresetAppend }: DraftPromptSectionProps) {
  const { t } = useTranslation()
  const { allPrompts, selectedPromptId, selectPrompt } = usePrompts()

  return (
    <div className="border-border/70 bg-muted/15 border-t px-3.5 pt-3 pb-2.5">
      <label
        htmlFor="ai-draft-prompt"
        className="text-muted-foreground text-ql-10 tracking-ql-label mb-1.5 block font-semibold uppercase"
      >
        {t('ai_draft_prompt_label')}
      </label>
      <Select
        value={selectedPromptId ?? NONE_VALUE}
        onValueChange={(value) => selectPrompt(value === NONE_VALUE ? '' : value)}
      >
        <SelectTrigger
          id="ai-draft-prompt"
          className="bg-background/60 text-ql-12 h-8 w-full font-medium"
        >
          <SelectValue placeholder={t('ai_draft_no_prompt')} />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          sideOffset={6}
          className="w-(--radix-select-trigger-width) max-w-[min(26rem,90vw)] min-w-72"
        >
          <SelectItem value={NONE_VALUE} className="text-muted-foreground">
            {t('ai_draft_no_prompt')}
          </SelectItem>
          {allPrompts.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-ql-12">
              <span className="line-clamp-2 break-words whitespace-normal">
                {toOptionLabel(p.text)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-2.5">
        <PromptPresets onSelect={onPresetAppend} />
      </div>
    </div>
  )
}

export default memo(DraftPromptSection)
