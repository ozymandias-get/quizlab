import { useNotificationPrefs, useToastActions } from '@app/providers'

import { AlertTriangle, Bell, Check, Info, XCircle } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import SettingsTabIntro from './shared/SettingsTabIntro'
import SettingsToggleSwitch from './shared/SettingsToggleSwitch'

type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface NotificationTypeConfig {
  type: NotificationType
  color: string
  bg: string
  icon: typeof Check
  isEnabled: boolean
  setIsEnabled: (value: boolean) => void
  testKey: string
  testTitleKey: string
}

const NOTIFICATIONS_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-xl border p-2.5">
    <Bell className="h-5 w-5" />
  </div>
)

const NotificationsTab = memo(() => {
  const { t } = useTranslation()
  const { showSuccess, showError, showWarning, showInfo } = useToastActions()

  const {
    successEnabled,
    warningEnabled,
    errorEnabled,
    infoEnabled,
    setSuccessEnabled,
    setWarningEnabled,
    setErrorEnabled,
    setInfoEnabled
  } = useNotificationPrefs(
    useShallow((s) => ({
      successEnabled: s.successEnabled,
      warningEnabled: s.warningEnabled,
      errorEnabled: s.errorEnabled,
      infoEnabled: s.infoEnabled,
      setSuccessEnabled: s.setSuccessEnabled,
      setWarningEnabled: s.setWarningEnabled,
      setErrorEnabled: s.setErrorEnabled,
      setInfoEnabled: s.setInfoEnabled
    }))
  )

  const sendTestToast = useCallback(
    (type: NotificationType) => {
      switch (type) {
        case 'success':
          showSuccess('toast_config_saved')
          break
        case 'error':
          showError('toast_api_unavailable')
          break
        case 'warning':
          showWarning('connection_lost')
          break
        case 'info':
          showInfo('toast_opened')
          break
      }
    },
    [showSuccess, showError, showWarning, showInfo]
  )

  const notificationTypes: NotificationTypeConfig[] = [
    {
      type: 'success',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      icon: Check,
      isEnabled: successEnabled,
      setIsEnabled: setSuccessEnabled,
      testKey: 'notification_test_success',
      testTitleKey: 'notification_success_title'
    },
    {
      type: 'error',
      color: 'text-destructive',
      bg: 'bg-destructive/10 border-destructive/30',
      icon: XCircle,
      isEnabled: errorEnabled,
      setIsEnabled: setErrorEnabled,
      testKey: 'notification_test_error',
      testTitleKey: 'notification_error_title'
    },
    {
      type: 'warning',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
      icon: AlertTriangle,
      isEnabled: warningEnabled,
      setIsEnabled: setWarningEnabled,
      testKey: 'notification_test_warning',
      testTitleKey: 'notification_warning_title'
    },
    {
      type: 'info',
      color: 'text-primary',
      bg: 'bg-primary/10 border-primary/30',
      icon: Info,
      isEnabled: infoEnabled,
      setIsEnabled: setInfoEnabled,
      testKey: 'notification_test_info',
      testTitleKey: 'notification_info_title'
    }
  ]

  return (
    <div className="space-y-6">
      <SettingsTabIntro
        icon={NOTIFICATIONS_ICON}
        eyebrow={t('notification_settings')}
        title={t('notifications')}
        description={t('notifications_description')}
      />

      <div className="space-y-2">
        {notificationTypes.map((config) => {
          const Icon = config.icon
          return (
            <div
              key={config.type}
              className="border-border bg-card hover:bg-muted/40 flex items-center gap-4 rounded-xl border p-4 shadow-xs transition-colors"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${config.bg} ${config.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 grow">
                <h4 className="text-foreground text-xs leading-tight font-semibold">
                  {t(config.testTitleKey)}
                </h4>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  {t(`notification_${config.type}_description`)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => sendTestToast(config.type)}
                  className="border-border text-ql-11 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 rounded-lg border px-2.5 py-1 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {t(config.testKey)}
                </button>
                <SettingsToggleSwitch
                  checked={config.isEnabled}
                  onChange={config.setIsEnabled}
                  size="sm"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

NotificationsTab.displayName = 'NotificationsTab'

export default NotificationsTab
