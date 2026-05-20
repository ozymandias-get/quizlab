import { useLanguageStrings } from '@app/providers'
import type { Tab } from '@app/providers/AiContext'
import type { AiSiteMap } from '../../model/home'

interface AiHomeHeroProps {
  activeTab?: Tab
  activeTabId: string
  aiSites: AiSiteMap
  featuredIds: string[]
  isCompact: boolean
  isNarrow: boolean
  isUltraNarrow: boolean
  modelCount: number
  onOpenModel: (id: string) => void
  onSelectTab: (tabId: string) => void
  siteCount: number
  tabs: Tab[]
}

export default function AiHomeHero({
  activeTabId,
  aiSites,
  isCompact,
  onOpenModel,
  tabs
}: AiHomeHeroProps) {
  const { t } = useLanguageStrings()

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={isCompact ? 'max-w-none' : 'max-w-xl'}>
          <h1 className="font-semibold tracking-tight text-white/88 text-ql-18 sm:text-ql-22">
            {t('ai_home.title')}
          </h1>
          <p className="mt-2 text-ql-13 leading-relaxed text-white/50">
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
              <button
                key={tab.id}
                type="button"
                onClick={() => onOpenModel(tab.modelId)}
                className={`rounded-full border px-3 py-1 text-ql-12 transition-colors ${
                  isActive
                    ? 'border-white/15 bg-white/[0.06] text-white/85'
                    : 'border-white/8 bg-white/[0.02] text-white/55 hover:bg-white/[0.04] hover:text-white/75'
                }`}
              >
                {displayName}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
