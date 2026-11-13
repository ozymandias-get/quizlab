import { useNotificationPrefs, useToastActions } from '@app/providers'
import {
  Button,
  IconBadge,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowHeader,
  SettingsRowTitle,
  SettingsSection,
  SettingsTabIcon,
  SettingsTabIntro
} from '@shared/ui/components/primitives'

import { AlertTriangle, Bell, Check, Info, XCircle } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import SettingsToggleSwitch from './shared/SettingsToggleSwitch'

type NotificationType = 'success' | 'error' | 'warning' | 'info'
type NotificationBadgeVariant = 'success' | 'danger' | 'warning' | 'info'

interface NotificationTypeConfig {
  type: NotificationType
  variant: NotificationBadgeVariant
  icon: typeof Check
  isEnabled: boolean
  setIsEnabled: (value: boolean) => void
  testKey: string
  testTitleKey: string
}

const NOTIFICATIONS_ICON = (
  <SettingsTabIcon>
    <Bell className="h-5 w-5" />
  </SettingsTabIcon>
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
      variant: 'success',
      icon: Check,
      isEnabled: successEnabled,
      setIsEnabled: setSuccessEnabled,
      testKey: 'notification_test_success',
      testTitleKey: 'notification_success_title'
    },
    {
      type: 'error',
      variant: 'danger',
      icon: XCircle,
      isEnabled: errorEnabled,
      setIsEnabled: setErrorEnabled,
      testKey: 'notification_test_error',
      testTitleKey: 'notification_error_title'
    },
    {
      type: 'warning',
      variant: 'warning',
      icon: AlertTriangle,
      isEnabled: warningEnabled,
      setIsEnabled: setWarningEnabled,
      testKey: 'notification_test_warning',
      testTitleKey: 'notification_warning_title'
    },
    {
      type: 'info',
      variant: 'info',
      icon: Info,
      isEnabled: infoEnabled,
      setIsEnabled: setInfoEnabled,
      testKey: 'notification_test_info',
      testTitleKey: 'notification_info_title'
    }
  ]

  return (
    <div className="space-y-6">
      <SettingsTabIntro icon={NOTIFICATIONS_ICON} description={t('notifications_description')} />

      <SettingsSection icon={<Bell className="h-4 w-4" />} title={t('notification_settings')}>
        <div className="flex flex-col gap-2">
          {notificationTypes.map((config) => {
            const enabled = config.isEnabled
            return (
              <SettingsRow
                key={config.type}
                className={`flex items-center gap-4 transition-colors ${
                  enabled
                    ? 'border-white/[0.07] bg-zinc-950/80'
                    : 'border-white/[0.07] bg-zinc-900/45 hover:bg-white/5'
                }`}
              >
                <IconBadge icon={config.icon} variant={config.variant} />

                <SettingsRowHeader>
                  <SettingsRowTitle>{t(config.testTitleKey)}</SettingsRowTitle>
                  <SettingsRowDescription>
                    {t(`notification_${config.type}_description`)}
                  </SettingsRowDescription>
                </SettingsRowHeader>

                <SettingsToggleSwitch checked={enabled} onChange={config.setIsEnabled} size="sm" />
              </SettingsRow>
            )
          })}
        </div>

        {/* One grouped preview surface instead of four loose debug buttons. */}
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-zinc-950/40 p-3.5">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="text-ql-10 text-muted-foreground tracking-ql-label font-semibold uppercase">
              {t('notification_preview_title')}
            </span>
            <span aria-hidden className="bg-border h-px flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {notificationTypes.map((config) => (
              <Button
                key={config.type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => sendTestToast(config.type)}
                className="justify-start gap-2"
              >
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${
                    config.type === 'success'
                      ? 'bg-emerald-500'
                      : config.type === 'error'
                        ? 'bg-destructive'
                        : config.type === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-sky-500'
                  }`}
                />
                <span className="text-ql-11 truncate">{t(config.testKey)}</span>
              </Button>
            ))}
          </div>
        </div>
      </SettingsSection>
    </div>
  )
})

NotificationsTab.displayName = 'NotificationsTab'

export default NotificationsTab
