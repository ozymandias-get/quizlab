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
      <div className="relative min-h-full px-4 py-8 sm:px-6 sm:py-10">
        <div className="relative z-10 flex flex-col gap-7">
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
            accent="#8e7755"
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
