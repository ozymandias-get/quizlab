import type { TextInputMode } from '@shared-core/types'

import {
  MAX_ALIVE_TABS_OPTIONS,
  SLEEP_TIMEOUT_OPTIONS,
  useAiLifecycleSettings
} from '@features/ai/hooks/useAiLifecycleSettings'
import { useTextInputMode } from '@features/ai/hooks/useTextInputMode'

import { useNotificationPrefs } from '@app/providers'

import {
  Bell,
  ClipboardPaste,
  Globe,
  Keyboard,
  Layers,
  Moon,
  PenLine,
  Sparkles
} from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import QuickSettingRow from './QuickSettingRow'

export const TextInputModeCard = memo(function TextInputModeCard({
  t
}: {
  t: (key: string) => string
}) {
  const { textInputMode, setTextInputMode } = useTextInputMode()

  const options: {
    value: TextInputMode
    labelKey: string
    icon: typeof Sparkles
  }[] = [
    { value: 'auto', labelKey: 'text_input_mode_auto', icon: Sparkles },
    { value: 'paste', labelKey: 'text_input_mode_paste', icon: ClipboardPaste },
    { value: 'typing', labelKey: 'text_input_mode_typing', icon: PenLine }
  ]

  return (
    <QuickSettingRow
      icon={<Keyboard className="text-primary h-4 w-4" />}
      iconBorder="border-primary/20 bg-primary/10"
      title={t('text_input_mode')}
      description={t('text_input_mode_description')}
    >
      <div className="flex gap-1.5">
        {options.map((opt) => {
          const active = textInputMode === opt.value
          const Icon = opt.icon
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => setTextInputMode(opt.value)}
              className={`text-ql-11 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition-colors ${
                active
                  ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3 w-3" />
              {t(opt.labelKey)}
            </button>
          )
        })}
      </div>
    </QuickSettingRow>
  )
})

export const SleepTimeoutCard = memo(function SleepTimeoutCard({
  t
}: {
  t: (key: string) => string
}) {
  const { sleepTimeoutMs, setSleepTimeoutMs } = useAiLifecycleSettings()

  return (
    <QuickSettingRow
      icon={<Moon className="text-primary h-4 w-4" />}
      iconBorder="border-primary/20 bg-primary/10"
      title={t('sleep_timeout')}
      description={t('sleep_timeout_description')}
    >
      <div className="flex flex-wrap gap-1.5">
        {SLEEP_TIMEOUT_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => setSleepTimeoutMs(opt.value)}
            className={`text-ql-11 rounded-lg border px-2.5 py-1.5 font-medium transition-colors ${
              sleepTimeoutMs === opt.value
                ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </QuickSettingRow>
  )
})

export const MaxAliveTabsCard = memo(function MaxAliveTabsCard({
  t
}: {
  t: (key: string) => string
}) {
  const { maxAliveTabs, setMaxAliveTabs } = useAiLifecycleSettings()

  return (
    <QuickSettingRow
      icon={<Layers className="text-primary h-4 w-4" />}
      iconBorder="border-primary/20 bg-primary/10"
      title={t('max_alive_tabs')}
      description={t('max_alive_tabs_description')}
    >
      <div className="flex gap-1.5">
        {MAX_ALIVE_TABS_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt}
            onClick={() => setMaxAliveTabs(opt)}
            className={`text-ql-11 flex min-w-[36px] items-center justify-center rounded-lg border px-3 py-1.5 font-medium transition-colors ${
              maxAliveTabs === opt
                ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </QuickSettingRow>
  )
})

export const NotificationsCard = memo(function NotificationsCard({
  t
}: {
  t: (key: string) => string
}) {
  const { successEnabled, setSuccessEnabled } = useNotificationPrefs()

  return (
    <QuickSettingRow
      icon={<Bell className="text-primary h-4 w-4" />}
      iconBorder="border-primary/20 bg-primary/10"
      title={t('notifications')}
      description={t('notifications_description')}
    >
      <button
        type="button"
        onClick={() => setSuccessEnabled(!successEnabled)}
        className={`text-ql-11 rounded-lg border px-3 py-1.5 font-medium transition-colors ${
          successEnabled
            ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
            : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        {successEnabled ? t('on') : t('off')}
      </button>
    </QuickSettingRow>
  )
})

export const LanguageCard = memo(function LanguageCard({
  t,
  setActiveTab
}: {
  t: (key: string) => string
  setActiveTab: (id: string) => void
}) {
  const { i18n } = useTranslation()
  const language = i18n.language

  return (
    <QuickSettingRow
      icon={<Globe className="text-primary h-4 w-4" />}
      iconBorder="border-primary/20 bg-primary/10"
      title={t('interface_language')}
      description={t('language_description')}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium uppercase">{language}</span>
        <button
          type="button"
          onClick={() => setActiveTab('language')}
          className="text-ql-11 text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          {t('change')} →
        </button>
      </div>
    </QuickSettingRow>
  )
})
