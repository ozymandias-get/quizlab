import { memo } from 'react'

import {
  LanguageCard,
  MaxAliveTabsCard,
  NotificationsCard,
  SleepTimeoutCard,
  TextInputModeCard
} from './QuickSettingCards'

interface QuickSettingsProps {
  t: (key: string) => string
  setActiveTab: (id: string) => void
}

function QuickSettings({ t, setActiveTab }: QuickSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-0.5 px-1">
        <h3 className="text-ql-18 text-foreground font-semibold tracking-tight">
          {t('quick_settings')}
        </h3>
        <p className="text-ql-13 text-muted-foreground">{t('quick_settings_description')}</p>
      </div>

      <TextInputModeCard t={t} />
      <MaxAliveTabsCard t={t} />
      <NotificationsCard t={t} />
      <SleepTimeoutCard t={t} />
      <LanguageCard t={t} setActiveTab={setActiveTab} />
    </div>
  )
}

export default memo(QuickSettings)
