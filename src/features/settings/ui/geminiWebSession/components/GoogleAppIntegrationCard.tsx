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

export const GoogleAppIntegrationCard = memo(function GoogleAppIntegrationCard({
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
      className={`cursor-pointer rounded-2xl border px-3 py-3 transition-colors ${
        isEnabled ? 'border-white/12 bg-white/[0.05]' : 'border-white/8 bg-black/20'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-white/20'}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10"
            style={{ backgroundColor: `${app.color}22`, color: app.color }}
          >
            {getAiIcon(app.icon) || <GeminiIcon className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-ql-14 truncate font-bold text-white/90">{app.name}</p>
            <p className="text-ql-12 truncate text-white/45">{app.hostname}</p>
            <p
              className={`text-ql-10 tracking-ql-fine mt-1 font-medium ${isEnabled ? 'text-emerald-300/70' : 'text-white/30'}`}
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
          className={`relative flex h-6 w-11 shrink-0 items-center rounded-full border p-1 transition-colors disabled:opacity-50 ${
            isEnabled ? 'border-emerald-500/35 bg-emerald-500/20' : 'border-white/15 bg-white/10'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full transition-colors ${
              isEnabled ? 'translate-x-5 bg-emerald-400' : 'translate-x-0 bg-white/60'
            }`}
          />
        </Switch>
      </div>
    </div>
  )
})
