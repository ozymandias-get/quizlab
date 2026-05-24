import { Switch } from '@headlessui/react'
import { useLanguageStrings } from '@app/providers'
import { GeminiIcon, getAiIcon } from '@ui/components/Icons'
import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'

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
  onToggle: () => void
}

export function GoogleAppIntegrationCard({
  app,
  isEnabled,
  disabled,
  onToggle
}: GoogleAppIntegrationCardProps) {
  const { t } = useLanguageStrings()

  return (
    <div
      className={`rounded-2xl border px-3 py-3 transition-all ${
        isEnabled ? 'border-white/12 bg-white/[0.05]' : 'border-white/8 bg-black/20'
      }`}
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
            <p className="truncate text-ql-14 font-bold text-white/90">{app.name}</p>
            <p className="truncate text-ql-12 text-white/45">{app.hostname}</p>
            <p
              className={`mt-1 text-ql-10 font-medium tracking-ql-fine ${isEnabled ? 'text-emerald-300/70' : 'text-white/30'}`}
            >
              {isEnabled ? t('gws_app_enabled') : t('gws_app_disabled')}
            </p>
          </div>
        </div>
        <Switch
          checked={isEnabled}
          onChange={onToggle}
          disabled={disabled}
          className={`relative flex h-6 w-11 shrink-0 items-center rounded-full border p-1 transition-all disabled:opacity-50 ${
            isEnabled ? 'border-emerald-500/35 bg-emerald-500/20' : 'border-white/15 bg-white/10'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full transition-all ${
              isEnabled ? 'translate-x-5 bg-emerald-400' : 'translate-x-0 bg-white/60'
            }`}
          />
        </Switch>
      </div>
    </div>
  )
}
