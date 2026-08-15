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
    <div className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-xs">
      <div className="space-y-1">
        <h3 className="text-ql-13 text-foreground font-semibold">{t('api_chat_memory_title')}</h3>
        <p className="text-ql-12 text-muted-foreground">{t('api_chat_memory_desc')}</p>
      </div>
      <Textarea
        value={memoryPrompt}
        onChange={(e) => onChange({ memoryPrompt: e.target.value })}
        rows={3}
        placeholder={t('api_chat_memory_placeholder')}
      />

      <div className="space-y-1">
        <h3 className="text-ql-13 text-foreground font-semibold">
          {t('api_chat_character_title')}
        </h3>
        <p className="text-ql-12 text-muted-foreground">{t('api_chat_character_desc')}</p>
      </div>
      <Textarea
        value={characterPrompt}
        onChange={(e) => onChange({ characterPrompt: e.target.value })}
        rows={2}
        placeholder={t('api_chat_character_placeholder')}
      />

      <div className="space-y-1">
        <h3 className="text-ql-13 text-foreground font-semibold">
          {t('api_chat_system_prompt_title')}
        </h3>
        <p className="text-ql-12 text-muted-foreground">{t('api_chat_system_prompt_desc')}</p>
      </div>
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
