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
  enabled: boolean
  setEnabled: (value: boolean) => void
  testKey: string
  testTitleKey: string
}

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
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15 border-emerald-500/20',
      icon: Check,
      enabled: successEnabled,
      setEnabled: setSuccessEnabled,
      testKey: 'notification_test_success',
      testTitleKey: 'notification_success_title'
    },
    {
      type: 'error',
      color: 'text-red-400',
      bg: 'bg-red-500/15 border-red-500/20',
      icon: XCircle,
      enabled: errorEnabled,
      setEnabled: setErrorEnabled,
      testKey: 'notification_test_error',
      testTitleKey: 'notification_error_title'
    },
    {
      type: 'warning',
      color: 'text-amber-400',
      bg: 'bg-amber-500/15 border-amber-500/20',
      icon: AlertTriangle,
      enabled: warningEnabled,
      setEnabled: setWarningEnabled,
      testKey: 'notification_test_warning',
      testTitleKey: 'notification_warning_title'
    },
    {
      type: 'info',
      color: 'text-blue-400',
      bg: 'bg-blue-500/15 border-blue-500/20',
      icon: Info,
      enabled: infoEnabled,
      setEnabled: setInfoEnabled,
      testKey: 'notification_test_info',
      testTitleKey: 'notification_info_title'
    }
  ]

  return (
    <div className="space-y-6">
      <SettingsTabIntro
        icon={
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-2.5 text-emerald-400">
            <Bell className="h-5 w-5" />
          </div>
        }
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
              className="border-border bg-card flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-white/[0.04]"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${config.bg} ${config.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 grow">
                <h4 className="text-xs leading-tight font-semibold text-white/88">
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
                  className="border-border hover:border-ring/30 text-ql-11 rounded-lg border px-2.5 py-1.5 font-medium text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/65 active:scale-95"
                >
                  {t(config.testKey)}
                </button>
                <SettingsToggleSwitch
                  checked={config.enabled}
                  onChange={config.setEnabled}
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
