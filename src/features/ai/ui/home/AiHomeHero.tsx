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
  tabs: Tab[]
}

const AiHomeHero = memo(function AiHomeHero({
  activeTabId,
  aiSites,
  isCompact,
  onOpenModel,
  tabs
}: AiHomeHeroProps) {
  const { t } = useTranslation()

  return (
    <section className="border-border/60 bg-card/30 flex flex-col gap-4 rounded-2xl border p-5">
      <div className={isCompact ? 'max-w-none' : 'max-w-2xl'}>
        <h1 className="text-foreground text-ql-18 tracking-ql-tight font-semibold">
          {t('ai_home.title')}
        </h1>
        <p className="text-ql-12 text-muted-foreground mt-1.5 leading-relaxed">
          {t('ai_home.description')}
        </p>
      </div>

      {tabs.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-2">
            <span className="text-ql-10 tracking-ql-label font-semibold uppercase">
              {t('ai_home_open_tabs_label')}
            </span>
            <span aria-hidden className="bg-border h-px flex-1" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tabs.slice(0, 5).map((tab) => {
              const site = aiSites[tab.modelId]
              const isActive = tab.id === activeTabId
              const displayName = tab.title || site?.displayName || site?.name || tab.modelId
              return (
                <Button
                  key={tab.id}
                  type="button"
                  variant={isActive ? 'outline' : 'ghost'}
                  size="xs"
                  onClick={() => onOpenModel(tab.modelId)}
                  className="rounded-full border px-3 py-1"
                >
                  {displayName}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {tabs.length === 0 && (
        <div className="text-muted-foreground flex items-center gap-2">
          <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
          <p className="text-ql-12">{t('ai_home.get_started_hint')}</p>
        </div>
      )}
    </section>
  )
})

export default AiHomeHero
