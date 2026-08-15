import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'

import { GeminiIcon, getAiIcon } from '@ui/components/Icons'

import { Switch } from '@headlessui/react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface GoogleAppIntegrationCardProps {
  app: {
    id: GoogleWebSessionAppId
    name: string
    hostname: string
    color: string
    icon: string
  }
  isEnabled: boolean
  disabled: boolean
  onToggleManagedApp: (appId: GoogleWebSessionAppId) => void
}

const GoogleAppIntegrationCard = memo(function GoogleAppIntegrationCard({
  app,
  isEnabled,
  disabled,
  onToggleManagedApp
}: GoogleAppIntegrationCardProps) {
  const { t } = useTranslation()
  const handleToggle = useCallback(() => onToggleManagedApp(app.id), [app.id, onToggleManagedApp])
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleToggle()
      }
    },
    [handleToggle]
  )

  return (
    <div
      onClick={disabled ? undefined : handleToggle}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={disabled ? undefined : handleKeyDown}
      aria-disabled={disabled}
      aria-label={app.name}
      className={`cursor-pointer rounded-xl border px-3.5 py-3 transition-colors ${
        isEnabled
          ? 'border-primary/40 bg-muted/80 shadow-xs'
          : 'border-border bg-card hover:bg-muted/40'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="border-border flex h-9 w-9 items-center justify-center rounded-lg border"
            style={{ backgroundColor: `${app.color}18`, color: app.color }}
          >
            {getAiIcon(app.icon) || <GeminiIcon className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-ql-13 text-foreground truncate font-semibold">{app.name}</p>
            <p className="text-ql-11 text-muted-foreground truncate">{app.hostname}</p>
            <p
              className={`text-ql-10 mt-0.5 font-medium ${isEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
            >
              {isEnabled ? t('gws_app_enabled') : t('gws_app_disabled')}
            </p>
          </div>
        </div>
        <Switch
          checked={isEnabled}
          onChange={disabled ? undefined : handleToggle}
          disabled={disabled}
          aria-label={app.name}
          className={`relative flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors disabled:opacity-50 ${
            isEnabled ? 'border-emerald-500/40 bg-emerald-500/20' : 'border-border bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full transition-colors ${
              isEnabled ? 'translate-x-5 bg-emerald-500' : 'bg-muted-foreground translate-x-0'
            }`}
          />
        </Switch>
      </div>
    </div>
  )
})

export default GoogleAppIntegrationCard
