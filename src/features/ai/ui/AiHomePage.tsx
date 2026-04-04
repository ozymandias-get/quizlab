import { memo } from 'react'
import { Globe, Sparkles } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import { useAiHomeState } from '../hooks/useAiHomeState'
import AiHomeHero from './home/AiHomeHero'
import { AiHomeCardGrid, EmptySitesState } from './home/AiHomeCards'
import AiHomeSection from './home/AiHomeSection'

interface AiHomePageProps {
  onSelectTab: (tabId: string) => void
  onOpenModel: (modelId: string) => void
}

function AiHomePage({ onSelectTab, onOpenModel }: AiHomePageProps) {
  const { t } = useLanguageStrings()
  const {
    activeModelIds,
    activeTab,
    activeTabId,
    aiSites,
    cardColumns,
    featuredIds,
    isCompact,
    isNarrow,
    isUltraNarrow,
    modelDrag,
    modelOrder,
    pageRef,
    siteDrag,
    siteOrder,
    tabs
  } = useAiHomeState()

  return (
    <div
      ref={pageRef}
      className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar"
    >
      <div className="relative min-h-full px-4 py-4 sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-4 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(240,74,137,0.16),transparent_72%)] blur-3xl" />
          <div className="absolute right-[-6%] bottom-8 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(0,194,255,0.13),transparent_72%)] blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-3.5">
          <AiHomeHero
            activeTab={activeTab}
            activeTabId={activeTabId}
            aiSites={aiSites}
            featuredIds={featuredIds}
            isCompact={isCompact}
            isNarrow={isNarrow}
            isUltraNarrow={isUltraNarrow}
            modelCount={modelOrder.length}
            onOpenModel={onOpenModel}
            onSelectTab={onSelectTab}
            siteCount={siteOrder.length}
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
