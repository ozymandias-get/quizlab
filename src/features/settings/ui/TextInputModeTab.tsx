import type { TextInputMode } from '@shared-core/types'

import { TYPING_SPEED_OPTIONS, useTextInputMode } from '@features/ai'

import { cn } from '@shared/lib/uiUtils'
import {
  SettingsRowDescription,
  SettingsRowHeader,
  SettingsRowIcon,
  SettingsRowTitle,
  SettingsSection,
  SettingsTabIcon,
  SettingsTabIntro,
  TabPill,
  TabPillLabel
} from '@shared/ui/components/primitives'

import { ClipboardPaste, Gauge, Keyboard, PenLine, Sparkles } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

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
  <SettingsTabIcon>
    <Keyboard className="h-5 w-5" />
  </SettingsTabIcon>
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

      <div className="space-y-4">
        <SettingsSection icon={<Keyboard className="h-4 w-4" />} title={t('text_input_mode')}>
          <div
            className="flex flex-col gap-2"
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
                  className={cn(
                    'focus-visible:ring-ring/40 flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    isActive
                      ? 'border-ring/50 bg-accent/30'
                      : 'border-border/60 bg-card hover:bg-muted/50'
                  )}
                >
                  <SettingsRowIcon>
                    <Icon className="h-4 w-4" />
                  </SettingsRowIcon>
                  <SettingsRowHeader>
                    <SettingsRowTitle>{t(option.labelKey)}</SettingsRowTitle>
                    <SettingsRowDescription>{t(option.descKey)}</SettingsRowDescription>
                  </SettingsRowHeader>
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1 size-4 shrink-0 rounded-full border-2 transition-colors',
                      isActive ? 'border-primary bg-primary' : 'border-border bg-transparent'
                    )}
                  />
                </button>
              )
            })}
          </div>
        </SettingsSection>

        <SettingsSection
          icon={<Gauge className="h-4 w-4" />}
          title={t('typing_speed')}
          detail={t('typing_speed_description')}
          action={
            <span className="text-muted-foreground text-ql-12 shrink-0 font-medium tabular-nums">
              {typingSpeed}ms
            </span>
          }
        >
          <div className="grid grid-cols-4 gap-2" role="tablist" aria-label={t('typing_speed')}>
            {TYPING_SPEED_OPTIONS.map((option) => {
              const isActive = typingSpeed === option.value

              return (
                <TabPill
                  key={option.value}
                  isActive={isActive}
                  onClick={() => handleSpeedChange(option.value)}
                  aria-label={t(option.labelKey)}
                  className="justify-center rounded-lg py-2.5"
                >
                  <TabPillLabel isActive={isActive} className="text-center">
                    {t(option.labelKey)}
                  </TabPillLabel>
                </TabPill>
              )
            })}
          </div>
        </SettingsSection>
      </div>
    </div>
  )
})

TextInputModeTab.displayName = 'TextInputModeTab'

export default TextInputModeTab
