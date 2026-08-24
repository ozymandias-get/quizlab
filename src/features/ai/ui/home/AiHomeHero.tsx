import { Button } from '@app/components/ui/button'
import type { Tab } from '@app/providers/AiContext'

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
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={isCompact ? 'max-w-none' : 'max-w-xl'}>
          <h1 className="text-foreground text-ql-20 sm:text-ql-22 tracking-ql-tight font-semibold">
            {t('ai_home.title')}
          </h1>
          <p className="text-ql-13 text-muted-foreground mt-1.5 leading-relaxed">
            {t('ai_home.description')}
          </p>
        </div>
      </div>

      {tabs.length > 0 && (
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
      )}

      {tabs.length === 0 && (
        <p className="text-ql-12 text-muted-foreground/60 italic">
          {t('ai_home.get_started_hint')}
        </p>
      )}
    </section>
  )
})

export default AiHomeHero
