import { useLanguageStrings } from '@app/providers'

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

export function PromptSettingsSection({
  memoryPrompt,
  characterPrompt,
  generalPrompt,
  onChange
}: PromptSettingsSectionProps) {
  const { t } = useLanguageStrings()

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <h3 className="text-ql-13 font-medium text-white/70">
        {t('api_chat_memory_title') || 'Memory'}
      </h3>
      <p className="text-ql-11 text-white/40 -mt-3">
        {t('api_chat_memory_desc') ||
          'Information about yourself that the AI will remember across conversations. Not shown in chat.'}
      </p>
      <textarea
        value={memoryPrompt}
        onChange={(e) => onChange({ memoryPrompt: e.target.value })}
        rows={3}
        className="w-full rounded-lg border border-white/8 bg-zinc-900/60 px-3 py-2 text-ql-13 text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-amber-500/40 transition-colors"
        placeholder={
          t('api_chat_memory_placeholder') || "e.g. I'm a medical student studying cardiology..."
        }
      />

      <h3 className="text-ql-13 font-medium text-white/70">
        {t('api_chat_character_title') || 'Character'}
      </h3>
      <p className="text-ql-11 text-white/40 -mt-3">
        {t('api_chat_character_desc') || "Define the AI's personality and tone. Not shown in chat."}
      </p>
      <textarea
        value={characterPrompt}
        onChange={(e) => onChange({ characterPrompt: e.target.value })}
        rows={2}
        className="w-full rounded-lg border border-white/8 bg-zinc-900/60 px-3 py-2 text-ql-13 text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-amber-500/40 transition-colors"
        placeholder={
          t('api_chat_character_placeholder') || 'e.g. You are a knowledgeable and patient tutor...'
        }
      />

      <h3 className="text-ql-13 font-medium text-white/70">
        {t('api_chat_system_prompt_title') || 'System Prompt'}
      </h3>
      <p className="text-ql-11 text-white/40 -mt-3">
        {t('api_chat_system_prompt_desc') || 'General system instructions. Not shown in chat.'}
      </p>
      <textarea
        value={generalPrompt}
        onChange={(e) => onChange({ generalPrompt: e.target.value })}
        rows={2}
        className="w-full rounded-lg border border-white/8 bg-zinc-900/60 px-3 py-2 text-ql-13 text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-amber-500/40 transition-colors"
        placeholder={
          t('api_chat_system_prompt_placeholder') || 'e.g. You are a helpful assistant...'
        }
      />
    </div>
  )
}
