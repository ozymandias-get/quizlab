import { memo } from 'react'
import { useTranslation } from 'react-i18next'

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

export default memo(QuickSettings)
