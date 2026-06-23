import type { TextInputMode } from '@shared-core/types'

import { TYPING_SPEED_OPTIONS, useTextInputMode } from '@features/ai/hooks/useTextInputMode'

import { ClipboardPaste, Gauge, Keyboard, PenLine, Sparkles } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsTabIntro from './shared/SettingsTabIntro'

const TEXT_INPUT_MODE_OPTIONS: {
  value: TextInputMode
  labelKey: string
  descKey: string
  icon: typeof Keyboard
  color: string
}[] = [
  {
    value: 'auto',
    labelKey: 'text_input_mode_auto',
    descKey: 'text_input_mode_auto_desc',
    icon: Sparkles,
    color: 'orange'
  },
  {
    value: 'paste',
    labelKey: 'text_input_mode_paste',
    descKey: 'text_input_mode_paste_desc',
    icon: ClipboardPaste,
    color: 'cyan'
  },
  {
    value: 'typing',
    labelKey: 'text_input_mode_typing',
    descKey: 'text_input_mode_typing_desc',
    icon: PenLine,
    color: 'violet'
  }
]

const COLOR_MAP: Record<string, { active: string; inactive: string; icon: string }> = {
  orange: {
    active: 'border-orange-500/30 bg-orange-500/15 text-orange-300 shadow-lg shadow-orange-500/10',
    inactive: 'bg-card border-border text-white/45 hover:bg-white/[0.06] hover:text-white/65',
    icon: 'border-orange-500/20 bg-orange-500/15 text-orange-400'
  },
  cyan: {
    active: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300 shadow-lg shadow-cyan-500/10',
    inactive: 'bg-card border-border text-white/45 hover:bg-white/[0.06] hover:text-white/65',
    icon: 'border-cyan-500/20 bg-cyan-500/15 text-cyan-400'
  },
  violet: {
    active: 'border-violet-500/30 bg-violet-500/15 text-violet-300 shadow-lg shadow-violet-500/10',
    inactive: 'bg-card border-border text-white/45 hover:bg-white/[0.06] hover:text-white/65',
    icon: 'border-violet-500/20 bg-violet-500/15 text-violet-400'
  }
}

const TextInputModeTab = memo(() => {
  const { t } = useTranslation()
  const { textInputMode, typingSpeed, setTextInputMode, setTypingSpeed } = useTextInputMode()

  const handleSelect = useCallback(
    (mode: TextInputMode) => {
      setTextInputMode(mode)
    },
    [setTextInputMode]
  )

  const handleSpeedChange = useCallback(
    (speed: number) => {
      setTypingSpeed(speed)
    },
    [setTypingSpeed]
  )

  return (
    <div className="space-y-6">
      <SettingsTabIntro
        icon={
          <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/20 to-amber-500/20 p-2.5 text-orange-400">
            <Keyboard className="h-5 w-5" />
          </div>
        }
        eyebrow={t('ai_settings')}
        title={t('text_input_mode')}
        description={t('text_input_mode_description')}
      />

      <div className="space-y-2 px-1">
        {TEXT_INPUT_MODE_OPTIONS.map((option) => {
          const isActive = textInputMode === option.value
          const colors = COLOR_MAP[option.color]
          const Icon = option.icon

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${isActive ? colors.active : colors.inactive} `}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${isActive ? colors.icon : 'bg-card border-white/10 text-white/30'} `}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 grow">
                <h4 className="text-xs leading-tight font-semibold">{t(option.labelKey)}</h4>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  {t(option.descKey)}
                </p>
              </div>
              <div
                className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-all duration-200 ${isActive ? 'border-current bg-current' : 'border-white/20 bg-transparent'} `}
              >
                {isActive && (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/15 text-amber-400">
            <Gauge className="h-4 w-4" />
          </div>
          <div className="min-w-0 grow">
            <h4 className="text-xs leading-tight font-semibold text-white/88">
              {t('typing_speed')}
            </h4>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {t('typing_speed_description')}
            </p>
          </div>
          <span className="text-muted-foreground/70 shrink-0 text-xs">{typingSpeed}ms</span>
        </div>

        <div className="grid grid-cols-4 gap-2 px-1">
          {TYPING_SPEED_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => handleSpeedChange(option.value)}
              className={`rounded-xl py-2.5 text-xs font-medium transition-all duration-200 ${
                typingSpeed === option.value
                  ? 'border border-amber-500/30 bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/10'
                  : 'bg-card border-border border text-white/45 hover:bg-white/[0.06] hover:text-white/65'
              } `}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})

TextInputModeTab.displayName = 'TextInputModeTab'

export default TextInputModeTab
