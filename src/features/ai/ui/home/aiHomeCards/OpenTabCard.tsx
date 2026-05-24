import { memo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import { getAiIcon } from '@ui/components/Icons'
import { safeAiAccentColor } from '../../../model/home'
import type { AiSiteMap } from '../../../model/home'

interface OpenTabCardProps {
  index: number
  isActive: boolean
  modelId: string
  onClick: () => void
  site?: AiSiteMap[string]
  tabId: string
  title?: string
}

export const OpenTabCard = memo<OpenTabCardProps>(function OpenTabCard({
  isActive,
  modelId,
  onClick,
  site,
  tabId,
  title
}: OpenTabCardProps) {
  const { t } = useLanguageStrings()
  const accent = safeAiAccentColor(site?.color)
  const displayName = title || site?.displayName || site?.name || modelId
  const icon = getAiIcon(site?.icon || modelId)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
        isActive
          ? 'border-white/14 bg-white/[0.06]'
          : 'border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]'
      }`}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04]"
        style={{ color: accent }}
      >
        {icon || <span className="text-ql-14 font-medium">{displayName.charAt(0)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-ql-13 font-semibold text-white/82">{displayName}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-ql-11 text-white/40">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: isActive ? accent : 'rgba(255,255,255,0.25)' }}
          />
          {isActive
            ? t('ai_home.active_session')
            : t('ai_home.ready_id', { id: tabId.slice(0, 8) })}
        </div>
      </div>
      <div className="text-white/35 transition-colors group-hover:text-white/60">
        <ArrowUpRight className="h-3.5 w-3.5" />
      </div>
    </button>
  )
})
