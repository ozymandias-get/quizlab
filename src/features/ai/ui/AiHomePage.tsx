import { memo } from 'react'
import { Globe, Sparkles } from 'lucide-react'
import { useLanguage } from '@app/providers'
import { useAiHomeState } from '../hooks/useAiHomeState'
import AiHomeHero from './home/AiHomeHero'
import { AiHomeCardGrid, EmptySitesState } from './home/AiHomeCards'
import AiHomeSection from './home/AiHomeSection'

interface AiHomePageProps {
  onSelectTab: (tabId: string) => void
  onOpenModel: (modelId: string) => void
}

function AiHomePage({ onSelectTab, onOpenModel }: AiHomePageProps) {
  const { t } = useLanguage()
  const {
    activeModelIds,
    activeTab,
    activeTabId,
    aiSites,
    cardColumns,
    featuredIds,
    heroColumns,
    isCompact,
    isNarrow,
    isUltraNarrow,
    modelDrag,
    modelOrder,
    pageRef,
    siteDrag,
    siteOrder,
    statsColumns,
    tabs
  } = useAiHomeState()

  return (
    <div
      ref={pageRef}
      className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar"
    >
      <div className="relative min-h-full px-4 py-4 sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-12%] top-6 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(240,74,137,0.18),transparent_72%)] blur-3xl" />
          <div className="absolute right-[-8%] top-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(0,194,255,0.14),transparent_72%)] blur-3xl" />
          <div className="absolute bottom-12 left-[34%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(91,113,255,0.12),transparent_74%)] blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-4">
          <AiHomeHero
            activeTab={activeTab}
            activeTabId={activeTabId}
            aiSites={aiSites}
            featuredIds={featuredIds}
            heroColumns={heroColumns}
            isCompact={isCompact}
            isNarrow={isNarrow}
            isUltraNarrow={isUltraNarrow}
            modelCount={modelOrder.length}
            onOpenModel={onOpenModel}
            onSelectTab={onSelectTab}
            siteCount={siteOrder.length}
            statsColumns={statsColumns}
            tabs={tabs}
          />

          <AiHomeSection
            title={t('ai_home.models_title')}
            detail={t('ai_home.models_detail')}
            icon={<Sparkles className="h-4 w-4" />}
            accent="#7c8cff"
            delay={0.09}
            defaultOpen={true}
          >
            <AiHomeCardGrid
              activeModelIds={activeModelIds}
              aiSites={aiSites}
              cardColumns={cardColumns}
              dragState={modelDrag}
              ids={modelOrder}
              onOpenModel={onOpenModel}
              tone="model"
            />
          </AiHomeSection>

          <AiHomeSection
            title={t('ai_home.sites_title')}
            detail={t('ai_home.sites_detail')}
            icon={<Globe className="h-4 w-4" />}
            accent="#f3b24f"
            delay={0.13}
            defaultOpen={false}
          >
            {siteOrder.length > 0 ? (
              <AiHomeCardGrid
                activeModelIds={activeModelIds}
                aiSites={aiSites}
                cardColumns={cardColumns}
                dragState={siteDrag}
                ids={siteOrder}
                onOpenModel={onOpenModel}
                tone="site"
              />
            ) : (
              <EmptySitesState />
            )}
          </AiHomeSection>
        </div>
      </div>
    </div>
  )
}

export default memo(AiHomePage)
