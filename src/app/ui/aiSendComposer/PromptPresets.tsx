import { memo } from 'react'
import { useLanguageStrings } from '@app/providers'

interface PromptPresetsProps {
  onSelect: (preset: string) => void
}

function PromptPresets({ onSelect }: PromptPresetsProps) {
  const { t } = useLanguageStrings()

  const presets = [
    { key: 'explain', label: t('ai_preset_explain'), value: t('ai_preset_explain_value') },
    { key: 'summarize', label: t('ai_preset_summarize'), value: t('ai_preset_summarize_value') },
    { key: 'quiz', label: t('ai_preset_quiz'), value: t('ai_preset_quiz_value') },
    { key: 'flashcard', label: t('ai_preset_flashcard'), value: t('ai_preset_flashcard_value') },
    { key: 'terms', label: t('ai_preset_terms'), value: t('ai_preset_terms_value') },
    { key: 'mechanism', label: t('ai_preset_mechanism'), value: t('ai_preset_mechanism_value') },
    { key: 'clinical', label: t('ai_preset_clinical'), value: t('ai_preset_clinical_value') },
    { key: 'review', label: t('ai_preset_review'), value: t('ai_preset_review_value') }
  ]

  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {presets.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onSelect(preset.value)}
          className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-white/45 transition-colors hover:border-white/[0.14] hover:text-white/70"
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}

export default memo(PromptPresets)
