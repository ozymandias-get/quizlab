import { ScrollArea } from '@app/components/ui/scroll-area'

import { Globe, Sparkles } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAiHomeState } from '../hooks/useAiHomeState'
import AiHomeCardGrid, { EmptySitesState } from './home/AiHomeCards'
import AiHomeHero from './home/AiHomeHero'
import AiHomeSection from './home/AiHomeSection'

/** Stable icon refs — hoisted outside the component so that `memo` on
 *  `AiHomeSection` actually works (inline JSX creates a new element on
 *  every render of the parent, breaking shallow comparison). */
const MODELS_SECTION_ICON = <Sparkles className="h-4 w-4" />
const SITES_SECTION_ICON = <Globe className="h-4 w-4" />

interface AiHomePageProps {
  onOpenModel: (modelId: string) => void
}

function AiHomePage({ onOpenModel }: AiHomePageProps) {
  const { t } = useTranslation()
  const {
    activeModelIds,
    activeTabId,
    aiSites,
    cardColumns,
    isCompact,
    modelDrag,
    modelOrder,
    pageRef,
    siteDrag,
    siteOrder,
    tabs
  } = useAiHomeState()

  return (
    <ScrollArea ref={pageRef} className="absolute inset-0">
      <div className="relative min-h-full px-4 py-8 sm:px-6 sm:py-10">
        <div className="relative z-10 flex flex-col gap-7">
          <AiHomeHero
            activeTabId={activeTabId}
            aiSites={aiSites}
            isCompact={isCompact}
            onOpenModel={onOpenModel}
            tabs={tabs}
          />

          <AiHomeSection
            title={t('ai_home.models_title')}
            detail={t('ai_home.models_detail')}
            icon={MODELS_SECTION_ICON}
            accent="#8e7755"
            defaultOpen
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
            icon={SITES_SECTION_ICON}
            accent="#f3b24f"
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
    </ScrollArea>
  )
}

export default memo(AiHomePage)
