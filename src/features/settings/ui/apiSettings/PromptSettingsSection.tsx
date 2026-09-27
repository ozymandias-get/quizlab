import { Textarea } from '@app/components/ui/textarea'
import { SettingsRowIcon } from '@shared/ui/components/primitives'

import { Brain, Terminal, UserRound } from 'lucide-react'
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

// `button, input, select, textarea { font: inherit }` in _base.css is
// unlayered, so it beats Tailwind's `text-*` utilities on those elements.
// The three textareas therefore inherit their size from the group wrapper
// below instead of carrying a dead `text-ql-12` on the control itself.
const PromptSettingsSection = memo(function PromptSettingsSection({
  memoryPrompt,
  characterPrompt,
  generalPrompt,
  onChange
}: PromptSettingsSectionProps) {
  const { t } = useTranslation()

  return (
    <section className="border-border/60 bg-card/30 flex flex-col gap-4 rounded-2xl border p-5">
      <div className="text-ql-12 flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <SettingsRowIcon>
            <Brain className="h-4 w-4" />
          </SettingsRowIcon>
          <div className="min-w-0 flex-1">
            <h3 className="text-ql-13 text-foreground font-semibold">
              {t('api_chat_memory_title')}
            </h3>
            <p className="text-ql-12 text-muted-foreground mt-0.5">{t('api_chat_memory_desc')}</p>
          </div>
        </div>
        <Textarea
          value={memoryPrompt}
          onChange={(e) => onChange({ memoryPrompt: e.target.value })}
          rows={3}
          placeholder={t('api_chat_memory_placeholder')}
        />
      </div>

      <div className="text-ql-12 flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <SettingsRowIcon>
            <UserRound className="h-4 w-4" />
          </SettingsRowIcon>
          <div className="min-w-0 flex-1">
            <h3 className="text-ql-13 text-foreground font-semibold">
              {t('api_chat_character_title')}
            </h3>
            <p className="text-ql-12 text-muted-foreground mt-0.5">
              {t('api_chat_character_desc')}
            </p>
          </div>
        </div>
        <Textarea
          value={characterPrompt}
          onChange={(e) => onChange({ characterPrompt: e.target.value })}
          rows={2}
          placeholder={t('api_chat_character_placeholder')}
        />
      </div>

      <div className="text-ql-12 flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <SettingsRowIcon>
            <Terminal className="h-4 w-4" />
          </SettingsRowIcon>
          <div className="min-w-0 flex-1">
            <h3 className="text-ql-13 text-foreground font-semibold">
              {t('api_chat_system_prompt_title')}
            </h3>
            <p className="text-ql-12 text-muted-foreground mt-0.5">
              {t('api_chat_system_prompt_desc')}
            </p>
          </div>
        </div>
        <Textarea
          value={generalPrompt}
          onChange={(e) => onChange({ generalPrompt: e.target.value })}
          rows={2}
          placeholder={t('api_chat_system_prompt_placeholder')}
        />
      </div>
    </section>
  )
})

export default PromptSettingsSection
PromptSettingsSection.displayName = 'PromptSettingsSection'
