import { DotPattern } from '@app/components/ui/dot-pattern'

import { Globe, History, Pin, Sparkles, Star } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useAiHomeState } from '../hooks/useAiHomeState'
import { usePinnedAiProjects } from '../hooks/usePinnedAiProjects'
import { useRecentAiWork } from '../hooks/useRecentAiWork'
import AiHomeCardGrid, { EmptySitesState } from './home/AiHomeCards'
import AiHomeHero from './home/AiHomeHero'
import AiHomePinnedProjects from './home/AiHomePinnedProjects'
import AiHomeRecentWork from './home/AiHomeRecentWork'
import AiHomeSection from './home/AiHomeSection'

/** Stable icon refs — hoisted outside the component so that `memo` on
 *  `AiHomeSection` actually works (inline JSX creates a new element on
 *  every render of the parent, breaking shallow comparison). */
const MODELS_SECTION_ICON = <Sparkles className="h-4 w-4" />
const SITES_SECTION_ICON = <Globe className="h-4 w-4" />
const FAVORITES_SECTION_ICON = <Star className="h-4 w-4 text-amber-500" />
const RECENT_SECTION_ICON = <History className="h-4 w-4" />
const PINNED_SECTION_ICON = <Pin className="h-4 w-4" />

interface AiHomePageProps {
  onOpenModel: (modelId: string) => void
  onOpenTab?: (tabId: string) => void
  getTabUrl?: (tabId: string, modelId: string) => string | undefined
  onOpenRecent?: (modelId: string, url: string) => void
  onOpenPinned?: (modelId: string, url: string) => void
}

function AiHomePage({
  onOpenModel,
  onOpenTab,
  getTabUrl,
  onOpenRecent,
  onOpenPinned
}: AiHomePageProps) {
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
  const { recentWorks, removeRecentWork } = useRecentAiWork()
  const { pinnedProjects, removePinnedProject } = usePinnedAiProjects()
  const handleOpenRecent = onOpenRecent ?? onOpenModel
  const handleOpenPinned = onOpenPinned ?? onOpenModel
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
        <DotPattern
          aria-hidden
          width={24}
          height={24}
          cr={1}
          className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)] text-zinc-500 opacity-10"
        />
        <div className="relative z-10 flex flex-col gap-4">
          <AiHomeHero
            activeTabId={activeTabId}
            aiSites={aiSites}
            isCompact={isCompact}
            onOpenModel={onOpenModel}
            onOpenTab={onOpenTab}
            getTabUrl={getTabUrl}
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

          <AiHomeSection
            title={t('ai_home.recent_title')}
            detail={t('ai_home.recent_detail')}
            icon={RECENT_SECTION_ICON}
            count={recentWorks.length}
            defaultOpen={false}
          >
            {recentWorks.length > 0 ? (
              <AiHomeRecentWork
                aiSites={aiSites}
                entries={recentWorks}
                onOpen={handleOpenRecent}
                onRemove={removeRecentWork}
              />
            ) : (
              <p className="text-ql-12 text-muted-foreground py-2">{t('ai_home.recent_empty')}</p>
            )}
          </AiHomeSection>

          <AiHomeSection
            title={t('ai_home.pinned_title')}
            detail={t('ai_home.pinned_detail')}
            icon={PINNED_SECTION_ICON}
            count={pinnedProjects.length}
            defaultOpen={false}
          >
            {pinnedProjects.length > 0 ? (
              <AiHomePinnedProjects
                aiSites={aiSites}
                projects={pinnedProjects}
                onOpen={handleOpenPinned}
                onRemove={removePinnedProject}
              />
            ) : (
              <p className="text-ql-12 text-muted-foreground py-2">{t('ai_home.pinned_empty')}</p>
            )}
          </AiHomeSection>
        </div>
      </div>
    </div>
  )
}

export default memo(AiHomePage)
