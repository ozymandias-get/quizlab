import { usePrompts } from '@features/ai'

import { ChevronDown } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import PromptPresets from './PromptPresets'

interface DraftPromptSectionProps {
  /** Hazır komutlar mevcut notun sonuna eklenir. */
  onPresetAppend: (preset: string) => void
}

/**
 * Kayıtlı prompt seçimi + hazır komutlar.
 *
 * Seçim prompt deposundan okunur (`usePrompts`), gönderim anında pipeline
 * tarafından bir kez uygulanır; not alanına dokunmaz.
 */
function DraftPromptSection({ onPresetAppend }: DraftPromptSectionProps) {
  const { t } = useTranslation()
  const { allPrompts, selectedPromptId, selectPrompt } = usePrompts()

  return (
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
        <PromptPresets onSelect={onPresetAppend} />
      </div>
    </div>
  )
}

export default memo(DraftPromptSection)
