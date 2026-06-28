import { Textarea } from '@app/components/ui/textarea'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface PromptSettingsSectionProps {
  memoryPrompt: string
  characterPrompt: string
  generalPrompt: string
  onChange: (patch: {
    memoryPrompt?: string
    characterPrompt?: string
    generalPrompt?: string
  }) => void
}

const PromptSettingsSection = memo(function PromptSettingsSection({
  memoryPrompt,
  characterPrompt,
  generalPrompt,
  onChange
}: PromptSettingsSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <h3 className="text-ql-13 font-medium text-white/70">{t('api_chat_memory_title')}</h3>
      <p className="text-ql-11 -mt-3 text-white/40">{t('api_chat_memory_desc')}</p>
      <Textarea
        value={memoryPrompt}
        onChange={(e) => onChange({ memoryPrompt: e.target.value })}
        rows={3}
        placeholder={t('api_chat_memory_placeholder')}
      />

      <h3 className="text-ql-13 font-medium text-white/70">{t('api_chat_character_title')}</h3>
      <p className="text-ql-11 -mt-3 text-white/40">{t('api_chat_character_desc')}</p>
      <Textarea
        value={characterPrompt}
        onChange={(e) => onChange({ characterPrompt: e.target.value })}
        rows={2}
        placeholder={t('api_chat_character_placeholder')}
      />

      <h3 className="text-ql-13 font-medium text-white/70">{t('api_chat_system_prompt_title')}</h3>
      <p className="text-ql-11 -mt-3 text-white/40">{t('api_chat_system_prompt_desc')}</p>
      <Textarea
        value={generalPrompt}
        onChange={(e) => onChange({ generalPrompt: e.target.value })}
        rows={2}
        placeholder={t('api_chat_system_prompt_placeholder')}
      />
    </div>
  )
})

export default PromptSettingsSection
PromptSettingsSection.displayName = 'PromptSettingsSection'
