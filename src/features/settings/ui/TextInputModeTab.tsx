import type { TextInputMode } from '@shared-core/types'

import { TYPING_SPEED_OPTIONS, useTextInputMode } from '@features/ai/hooks/useTextInputMode'

import {
  SettingsRow,
  SettingsRowDescription,
  SettingsRowHeader,
  SettingsRowIcon,
  SettingsRowTitle,
  TabPill
} from '@shared/ui/components/primitives'

import { ClipboardPaste, Gauge, Keyboard, PenLine, Sparkles } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsTabIntro from './shared/SettingsTabIntro'

const TEXT_INPUT_MODE_OPTIONS: {
  value: TextInputMode
  labelKey: string
  descKey: string
  icon: typeof Keyboard
}[] = [
  {
    value: 'auto',
    labelKey: 'text_input_mode_auto',
    descKey: 'text_input_mode_auto_desc',
    icon: Sparkles
  },
  {
    value: 'paste',
    labelKey: 'text_input_mode_paste',
    descKey: 'text_input_mode_paste_desc',
    icon: ClipboardPaste
  },
  {
    value: 'typing',
    labelKey: 'text_input_mode_typing',
    descKey: 'text_input_mode_typing_desc',
    icon: PenLine
  }
]

const TEXT_INPUT_MODE_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
    <Keyboard className="h-5 w-5" />
  </div>
)

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
        icon={TEXT_INPUT_MODE_ICON}
        description={t('text_input_mode_description')}
      />

      <div
        className="space-y-2 px-1"
        role="radiogroup"
        aria-label={t('text_input_mode_description')}
      >
        {TEXT_INPUT_MODE_OPTIONS.map((option) => {
          const isActive = textInputMode === option.value
          const Icon = option.icon

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => handleSelect(option.value)}
              className={`focus-visible:ring-ring/40 flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                isActive
                  ? 'border-primary/40 bg-muted/80 shadow-xs'
                  : 'bg-card border-border hover:bg-muted/40'
              } `}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                  isActive
                    ? 'border-primary/30 bg-primary/15 text-primary'
                    : 'border-border bg-muted/60 text-muted-foreground'
                } `}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 grow">
                <h4 className="text-foreground text-ql-12 leading-tight font-semibold">
                  {t(option.labelKey)}
                </h4>
                <p className="text-muted-foreground text-ql-12 mt-0.5 leading-relaxed">
                  {t(option.descKey)}
                </p>
              </div>
              <div
                className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                  isActive ? 'border-primary bg-primary' : 'border-border bg-transparent'
                } `}
              >
                {isActive && (
                  <div className="flex h-full items-center justify-center">
                    <div className="bg-primary-foreground h-1.5 w-1.5 rounded-full" />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <SettingsRow className="shadow-xs">
          <SettingsRowIcon>
            <Gauge className="h-4 w-4" />
          </SettingsRowIcon>
          <SettingsRowHeader>
            <SettingsRowTitle>{t('typing_speed')}</SettingsRowTitle>
            <SettingsRowDescription>{t('typing_speed_description')}</SettingsRowDescription>
          </SettingsRowHeader>
          <span className="text-muted-foreground text-ql-12 shrink-0 font-medium">
            {typingSpeed}ms
          </span>
        </SettingsRow>

        <div className="grid grid-cols-4 gap-2 px-1" role="tablist" aria-label={t('typing_speed')}>
          {TYPING_SPEED_OPTIONS.map((option) => (
            <TabPill
              key={option.value}
              isActive={typingSpeed === option.value}
              onClick={() => handleSpeedChange(option.value)}
              aria-label={t(option.labelKey)}
              className="justify-center rounded-xl py-2.5"
            >
              {t(option.labelKey)}
            </TabPill>
          ))}
        </div>
      </div>
    </div>
  )
})

TextInputModeTab.displayName = 'TextInputModeTab'

export default TextInputModeTab
