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
                    ? 'border-ring/50 bg-accent/30'
                    : 'border-border/60 bg-card hover:bg-muted/50'
                }`}
              >
                <IconBadge icon={config.icon} variant={config.variant} />

                <SettingsRowHeader>
                  <SettingsRowTitle>{t(config.testTitleKey)}</SettingsRowTitle>
                  <SettingsRowDescription>
                    {t(`notification_${config.type}_description`)}
                  </SettingsRowDescription>
                </SettingsRowHeader>

                <div className="flex shrink-0 items-center gap-2.5">
                  {/*
                    `button { font: inherit }` in _base.css is unlayered and beats
                    Tailwind's `:where()`-wrapped font utilities, so the Button's own
                    `text-xs`/`font-medium` are dead. Size and weight are set on this
                    non-button wrapper and inherited by the control instead.
                  */}
                  <span className="text-ql-12 inline-flex font-medium">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => sendTestToast(config.type)}
                    >
                      {t(config.testKey)}
                    </Button>
                  </span>

                  <SettingsToggleSwitch
                    checked={enabled}
                    onChange={config.setIsEnabled}
                    size="sm"
                  />
                </div>
              </SettingsRow>
            )
          })}
        </div>
      </SettingsSection>
    </div>
  )
})

NotificationsTab.displayName = 'NotificationsTab'

export default NotificationsTab
