import type { GoogleWebSessionAppId } from '@shared-core/constants/googleAiWebApps'

import { Switch } from '@app/components/ui/switch'
import { GeminiIcon, getAiIcon } from '@ui/components/Icons'

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

  return (
    // Clicking anywhere on the card toggles, but the accessible control is the
    // Switch below — the card itself must not be a second tab stop (no
    // role/tabIndex) or it would duplicate the toggle for assistive tech.
    /* eslint-disable jsx-a11y/click-events-have-key-events */
    <div
      onClick={disabled ? undefined : handleToggle}
      className={`cursor-pointer rounded-xl border px-3.5 py-3 transition-colors ${
        isEnabled
          ? 'border-primary/40 bg-muted/80 shadow-xs'
          : 'border-border bg-card hover:bg-muted/40'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {/* eslint-enable jsx-a11y/click-events-have-key-events */}
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
          onCheckedChange={handleToggle}
          disabled={disabled}
          aria-label={app.name}
          onClick={(e) => e.stopPropagation()}
          className={`shrink-0 ${
            isEnabled
              ? 'data-checked:border-emerald-500/30 data-checked:bg-emerald-500/20'
              : 'data-unchecked:border-border data-unchecked:bg-muted'
          }`}
        />
      </div>
    </div>
  )
})

export default GoogleAppIntegrationCard
