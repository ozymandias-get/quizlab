import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface PromptPresetsProps {
  onSelect: (preset: string) => void
}

function PromptPresets({ onSelect }: PromptPresetsProps) {
  const { t } = useTranslation()

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
    <div className="scrollbar-hidden flex flex-nowrap gap-1.5 overflow-x-auto">
      {presets.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onSelect(preset.value)}
          className="text-ql-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-semibold text-white/60 antialiased transition-colors outline-none hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-white/85 focus-visible:ring-1 focus-visible:ring-amber-500/50"
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}

export default memo(PromptPresets)
