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

interface QuickSettingsProps {
  t: (key: string) => string
  setActiveTab: (id: string) => void
}

function QuickSettings({ t, setActiveTab }: QuickSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1 px-1">
        <h3 className="text-ql-18 font-semibold tracking-tight text-white/88">
          {t('quick_settings')}
        </h3>
        <p className="text-xs leading-relaxed text-white/38">{t('quick_settings_description')}</p>
      </div>

      <TextInputModeCard t={t} />
      <MaxAliveTabsCard t={t} />
      <NotificationsCard t={t} />
      <SleepTimeoutCard t={t} />
      <LanguageCard t={t} setActiveTab={setActiveTab} />
    </div>
  )
}

const TextInputModeCard = memo(function TextInputModeCard({ t }: { t: (key: string) => string }) {
  const { textInputMode, setTextInputMode } = useTextInputMode()

  const options: {
    value: TextInputMode
    labelKey: string
    icon: typeof Sparkles
    color: string
  }[] = [
    { value: 'auto', labelKey: 'text_input_mode_auto', icon: Sparkles, color: 'orange' },
    { value: 'paste', labelKey: 'text_input_mode_paste', icon: ClipboardPaste, color: 'cyan' },
    { value: 'typing', labelKey: 'text_input_mode_typing', icon: PenLine, color: 'violet' }
  ]

  const colorMap: Record<string, string> = {
    orange: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
    cyan: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
    violet: 'border-violet-500/30 bg-violet-500/15 text-violet-300'
  }

  return (
    <QuickSettingRow
      icon={<Keyboard className="h-4 w-4" />}
      iconColor="text-orange-400"
      iconBorder="border-orange-500/20 bg-orange-500/15"
      title={t('text_input_mode')}
      description={t('text_input_mode_description')}
    >
      <div className="flex gap-2">
        {options.map((opt) => {
          const active = textInputMode === opt.value
          const Icon = opt.icon
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => setTextInputMode(opt.value)}
              className={`text-ql-11 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition-all duration-200 ${
                active
                  ? colorMap[opt.color]
                  : 'border-border bg-card text-muted-foreground hover:text-muted-foreground hover:bg-white/[0.04]'
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

const SleepTimeoutCard = memo(function SleepTimeoutCard({ t }: { t: (key: string) => string }) {
  const { sleepTimeoutMs, setSleepTimeoutMs } = useAiLifecycleSettings()

  return (
    <QuickSettingRow
      icon={<Moon className="h-4 w-4" />}
      iconColor="text-violet-400"
      iconBorder="border-violet-500/20 bg-violet-500/15"
      title={t('sleep_timeout')}
      description={t('sleep_timeout_description')}
    >
      <div className="flex flex-wrap gap-2">
        {SLEEP_TIMEOUT_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => setSleepTimeoutMs(opt.value)}
            className={`text-ql-11 rounded-lg border px-2.5 py-1.5 font-medium transition-all duration-200 ${
              sleepTimeoutMs === opt.value
                ? 'border-violet-500/30 bg-violet-500/15 text-violet-300'
                : 'border-border bg-card text-muted-foreground hover:text-muted-foreground hover:bg-white/[0.04]'
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </QuickSettingRow>
  )
})

const MaxAliveTabsCard = memo(function MaxAliveTabsCard({ t }: { t: (key: string) => string }) {
  const { maxAliveTabs, setMaxAliveTabs } = useAiLifecycleSettings()

  return (
    <QuickSettingRow
      icon={<Layers className="h-4 w-4" />}
      iconColor="text-sky-400"
      iconBorder="border-sky-500/20 bg-sky-500/15"
      title={t('max_alive_tabs')}
      description={t('max_alive_tabs_description')}
    >
      <div className="flex gap-2">
        {MAX_ALIVE_TABS_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt}
            onClick={() => setMaxAliveTabs(opt)}
            className={`text-ql-11 flex min-w-[36px] items-center justify-center rounded-lg border px-3 py-1.5 font-medium transition-all duration-200 ${
              maxAliveTabs === opt
                ? 'border-sky-500/30 bg-sky-500/15 text-sky-300'
                : 'border-border bg-card text-muted-foreground hover:text-muted-foreground hover:bg-white/[0.04]'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </QuickSettingRow>
  )
})

const NotificationsCard = memo(function NotificationsCard({ t }: { t: (key: string) => string }) {
  const { successEnabled, setSuccessEnabled } = useNotificationPrefs()

  const allEnabled = successEnabled

  return (
    <QuickSettingRow
      icon={<Bell className="h-4 w-4" />}
      iconColor="text-emerald-400"
      iconBorder="border-emerald-500/20 bg-emerald-500/15"
      title={t('notifications')}
      description={t('notifications_description')}
    >
      <button
        type="button"
        onClick={() => setSuccessEnabled(!allEnabled)}
        className={`text-ql-11 rounded-lg border px-3 py-1.5 font-medium transition-all duration-200 ${
          allEnabled
            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
            : 'border-border bg-card text-muted-foreground hover:text-muted-foreground hover:bg-white/[0.04]'
        }`}
      >
        {allEnabled ? t('on') : t('off')}
      </button>
    </QuickSettingRow>
  )
})

const LanguageCard = memo(function LanguageCard({
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
      icon={<Globe className="h-4 w-4" />}
      iconColor="text-lime-400"
      iconBorder="border-lime-500/20 bg-lime-500/15"
      title={t('interface_language')}
      description={t('language_description')}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground/70 text-xs font-medium uppercase">{language}</span>
        <button
          type="button"
          onClick={() => setActiveTab('language')}
          className="hover:text-muted-foreground text-ql-11 text-white/35 transition-colors"
        >
          {t('change')} →
        </button>
      </div>
    </QuickSettingRow>
  )
})

interface QuickSettingRowProps {
  icon: React.ReactNode
  iconColor: string
  iconBorder: string
  title: string
  description: string
  children: React.ReactNode
}

const QuickSettingRow = memo(function QuickSettingRow({
  icon,
  iconColor,
  iconBorder,
  title,
  description,
  children
}: QuickSettingRowProps) {
  return (
    <div className="border-border bg-card rounded-lg border p-3 transition-colors hover:border-white/[0.1]">
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconBorder} ${iconColor}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <h4 className="text-xs font-semibold text-white/85">{title}</h4>
            <p className="text-ql-11 leading-relaxed text-white/35">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
})

export default memo(QuickSettings)
