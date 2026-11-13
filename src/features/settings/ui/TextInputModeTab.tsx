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

import {
  ArrowRight,
  ClipboardPaste,
  FileText,
  Gauge,
  Keyboard,
  MessageSquare,
  PenLine,
  Sparkles
} from 'lucide-react'
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

function FlowStep({
  icon: Icon,
  label,
  caption,
  active = false
}: {
  icon: typeof Keyboard
  label: string
  caption?: string
  active?: boolean
}) {
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5',
        active
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'text-foreground border-white/[0.07] bg-white/[0.04]'
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="text-ql-11 block truncate font-medium">{label}</span>
        {caption && (
          <span className="text-ql-10 text-muted-foreground block truncate">{caption}</span>
        )}
      </span>
    </span>
  )
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

  const activeMode =
    TEXT_INPUT_MODE_OPTIONS.find((option) => option.value === textInputMode) ??
    TEXT_INPUT_MODE_OPTIONS[0]
  const ActiveModeIcon = activeMode.icon

  return (
    <div className="space-y-4">
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
                    'focus-visible:ring-ring/70 flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    isActive
                      ? 'border-white/[0.09] bg-white/[0.03]'
                      : 'border-white/[0.07] bg-transparent hover:bg-white/[0.03]'
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
                      isActive ? 'border-primary bg-primary' : 'border-white/20 bg-transparent'
                    )}
                  />
                </button>
              )
            })}
          </div>
        </SettingsSection>

        {/* Two-step working model: the selected mode decides whether a PDF
            selection lands in the draft strip first or goes straight to chat. */}
        <div className="rounded-xl border border-white/[0.07] bg-zinc-950/40 p-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <FlowStep icon={FileText} label={t('pdf_document')} />
            <ArrowRight className="text-muted-foreground/50 size-3.5 shrink-0" aria-hidden />
            <FlowStep
              icon={ActiveModeIcon}
              label={t(activeMode.labelKey)}
              active
              caption={t('text_input_mode')}
            />
            <ArrowRight className="text-muted-foreground/50 size-3.5 shrink-0" aria-hidden />
            <FlowStep
              icon={MessageSquare}
              label={t('api_chat_title')}
              caption={t('text_input_flow_chat')}
            />
          </div>
          <p className="text-ql-11 text-muted-foreground mt-2 text-center leading-relaxed">
            {t('text_input_flow_hint')}
          </p>
        </div>

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
          <div className="@container">
            <div
              className="grid grid-cols-2 gap-2 @min-[560px]:grid-cols-4"
              role="tablist"
              aria-label={t('typing_speed')}
            >
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
          </div>
        </SettingsSection>
      </div>
    </div>
  )
})

TextInputModeTab.displayName = 'TextInputModeTab'

export default TextInputModeTab
