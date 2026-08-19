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
          className="text-ql-10 border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 rounded-md border px-2 py-0.5 font-medium antialiased transition-colors outline-none focus-visible:ring-2"
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}

export default memo(PromptPresets)
