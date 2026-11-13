import type { Tab } from '@app/providers/ai-context'
import { Button } from '@shared/ui/components/primitives'

import { MousePointerClick } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import type { AiSiteMap } from '../../model/home'

interface AiHomeHeroProps {
  activeTabId: string
  aiSites: AiSiteMap
  isCompact: boolean
  onOpenModel: (id: string) => void
  /** Activates an already-open tab by id without creating a new session. */
  onOpenTab?: (tabId: string) => void
  /** Restored URL for an open tab, when the session has reported one. */
  getTabUrl?: (tabId: string, modelId: string) => string | undefined
  tabs: Tab[]
}

/** Short, human-readable suffix from a session URL; null when unavailable. */
function getSessionHint(url: string | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const tail = segments[segments.length - 1]
    if (!tail) return parsed.hostname.replace(/^www\./, '')
    const decoded = decodeURIComponent(tail)
    return decoded.length > 16 ? `${decoded.slice(0, 14)}…` : decoded
  } catch {
    return null
  }
}

const AiHomeHero = memo(function AiHomeHero({
  activeTabId,
  aiSites,
  isCompact,
  onOpenModel,
  onOpenTab,
  getTabUrl,
  tabs
}: AiHomeHeroProps) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-3 pt-1 pb-1">
      <div className={isCompact ? 'max-w-none' : 'max-w-2xl'}>
        <h1 className="text-foreground text-ql-18 tracking-ql-tight font-semibold">
          {t('ai_home.title')}
        </h1>
        <p className="text-ql-12 text-muted-foreground mt-1 leading-relaxed">
          {t('ai_home.description')}
        </p>
      </div>

      {tabs.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-2">
            <span className="text-ql-10 tracking-ql-label font-semibold uppercase">
              {t('ai_home_open_tabs_label')}
            </span>
            <span aria-hidden className="bg-border/50 h-px flex-1" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tabs.slice(0, 5).map((tab) => {
              const site = aiSites[tab.modelId]
              const isActive = tab.id === activeTabId
              const displayName = site?.displayName || site?.name || tab.modelId
              const sameModelTabs = tabs.filter((candidate) => candidate.modelId === tab.modelId)
              const sessionNumber =
                sameModelTabs.findIndex((candidate) => candidate.id === tab.id) + 1
              const sessionUrl = getTabUrl?.(tab.id, tab.modelId)
              const sessionHint = getSessionHint(sessionUrl)
              // Duplicate model sessions need a stable, visible distinction; the
              // URL tail is used when the session has reported one.
              const label =
                sameModelTabs.length > 1
                  ? `${displayName}${sessionHint ? ` · ${sessionHint}` : ''} (${sessionNumber})`
                  : displayName
              return (
                <Button
                  key={tab.id}
                  type="button"
                  variant={isActive ? 'outline' : 'ghost'}
                  size="xs"
                  onClick={() => (onOpenTab ? onOpenTab(tab.id) : onOpenModel(tab.modelId))}
                  aria-current={isActive ? 'true' : undefined}
                  title={sessionUrl ?? label}
                  className="max-w-[220px] rounded-full border px-3 py-1"
                >
                  <span className="min-w-0 truncate">{label}</span>
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {tabs.length === 0 && (
        <div className="text-muted-foreground flex items-center gap-2">
          <MousePointerClick
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: 'var(--selection-color-source, currentColor)' }}
          />
          <p className="text-ql-12">{t('ai_home.get_started_hint')}</p>
        </div>
      )}
    </section>
  )
})

export default AiHomeHero
