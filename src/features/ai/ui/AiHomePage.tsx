import { Globe, Sparkles, Star } from 'lucide-react'
import { memo, useCallback } from 'react'
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
const FAVORITES_SECTION_ICON = <Star className="h-4 w-4 text-amber-500" />

interface AiHomePageProps {
  onOpenModel: (modelId: string) => void
}

function AiHomePage({ onOpenModel }: AiHomePageProps) {
  const { t } = useTranslation()
  const {
    activeModelIds,
    activeTabId,
    aiSites,
    enableModel,
    favoriteOrder,
    favoriteDrag,
    cardColumns,
    isCompact,
    modelDrag,
    modelOrder,
    pageRef,
    siteDrag,
    siteOrder,
    tabs
  } = useAiHomeState()
  const handleOpenModel = useCallback(
    (id: string) => {
      enableModel(id)
      onOpenModel(id)
    },
    [enableModel, onOpenModel]
  )

  return (
    <div
      ref={pageRef}
      className="custom-scrollbar absolute inset-0 overflow-y-auto overscroll-contain"
    >
      <div className="relative min-h-full px-4 py-5 sm:px-5 sm:py-6">
        <div className="relative z-10 flex flex-col gap-4">
          <AiHomeHero
            activeTabId={activeTabId}
            aiSites={aiSites}
            isCompact={isCompact}
            onOpenModel={onOpenModel}
            tabs={tabs}
          />

          <AiHomeSection
            title={t('ai_home.favorites_title')}
            detail={t('ai_home.favorites_detail')}
            icon={FAVORITES_SECTION_ICON}
            count={favoriteOrder.length}
            defaultOpen={false}
          >
            {favoriteOrder.length > 0 ? (
              <AiHomeCardGrid
                activeModelIds={activeModelIds}
                aiSites={aiSites}
                cardColumns={cardColumns}
                dragState={favoriteDrag}
                ids={favoriteOrder}
                onOpenModel={onOpenModel}
                tone="model"
                showApiChat={favoriteOrder.includes('api-chat')}
              />
            ) : (
              <p className="text-ql-12 text-muted-foreground py-2">
                {t('ai_home.favorites_empty')}
              </p>
            )}
          </AiHomeSection>

          <AiHomeSection
            title={t('ai_home.models_title')}
            detail={t('ai_home.models_detail')}
            icon={MODELS_SECTION_ICON}
            count={modelOrder.length}
            defaultOpen={false}
          >
            <AiHomeCardGrid
              activeModelIds={activeModelIds}
              aiSites={aiSites}
              cardColumns={cardColumns}
              dragState={modelDrag}
              ids={modelOrder}
              onOpenModel={handleOpenModel}
              tone="model"
            />
          </AiHomeSection>

          <AiHomeSection
            title={t('ai_home.sites_title')}
            detail={t('ai_home.sites_detail')}
            icon={SITES_SECTION_ICON}
            count={siteOrder.length}
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
