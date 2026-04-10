import { motion } from 'framer-motion'
import { Compass, Globe, Sparkles } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import type { Tab } from '@app/providers/AiContext'
import type { AiSiteMap } from '../../model/home'
import { OpenTabsToggle, StatChip } from './AiHomeCards'

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
  activeTab,
  activeTabId,
  aiSites,
  featuredIds,
  isCompact,
  isNarrow: _isNarrow,
  isUltraNarrow: _isUltraNarrow,
  modelCount,
  onOpenModel,
  onSelectTab,
  siteCount,
  tabs
}: AiHomeHeroProps) {
  const { t } = useLanguageStrings()

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38 }}
      className="glass-tier-2 relative overflow-hidden rounded-[32px] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4">
        <div
          className={`flex gap-4 ${isCompact ? 'flex-col' : 'flex-row items-start justify-between'}`}
        >
          <div className={isCompact ? 'max-w-none' : 'max-w-2xl'}>
            <h1 className="font-semibold tracking-tight text-white/92 text-ql-20 sm:text-ql-28">
              {t('ai_home.title')}
            </h1>
            <p
              className={`mt-2.5 text-ql-14 leading-relaxed text-white/48 ${isCompact ? 'max-w-none' : 'max-w-xl'}`}
            >
              {t('ai_home.description')}
            </p>
          </div>
          <div
            className="flex flex-col gap-2.5"
            style={{ width: isCompact ? '100%' : undefined, minWidth: isCompact ? undefined : 340 }}
          >
            <OpenTabsToggle
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={onSelectTab}
              aiSites={aiSites}
            />
            <div className="flex flex-wrap gap-2">
              <StatChip
                compact
                icon={<Sparkles className="h-3.5 w-3.5" />}
                value={String(modelCount)}
                label={t('ai_home.ready_model')}
                accent="#8e7755"
              />
              <StatChip
                compact
                icon={<Globe className="h-3.5 w-3.5" />}
                value={String(siteCount)}
                label={t('ai_home.custom_site_count')}
                accent="#f3b24f"
              />
            </div>
          </div>
        </div>

        <div className="glass-tier-3 rounded-[28px] p-4 sm:px-5">
          <div className={`flex gap-4 ${isCompact ? 'flex-col' : 'flex-row items-stretch'}`}>
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <div className="glass-tier-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-white/[0.12] text-white/75 shadow-none">
                <Compass className="h-[17px] w-[17px]" />
              </div>
              <div className="min-w-0">
                <div className="text-ql-14 font-semibold text-white/84">
                  {activeTab
                    ? t('ai_home.active_ready_title', {
                        name: aiSites[activeTab.modelId]?.displayName || activeTab.modelId
                      })
                    : t('ai_home.home_state')}
                </div>
                <div className="mt-1 text-ql-12 leading-relaxed text-white/42">
                  {activeTab
                    ? t('ai_home.active_ready_description')
                    : t('ai_home.home_state_description')}
                </div>
              </div>
            </div>

            <div
              className={`shrink-0 bg-gradient-to-b from-transparent via-white/[0.12] to-transparent ${isCompact ? 'h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent' : 'hidden w-px self-stretch sm:block'}`}
              aria-hidden
            />

            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="text-ql-10 uppercase tracking-ql-spread text-white/32">
                {t('ai_home.featured')}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {featuredIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpenModel(id)}
                    className="glass-tier-3 glass-tier-control glass-interactive rounded-full border-white/[0.12] px-3.5 py-1.5 text-ql-12 text-white/72 shadow-none hover:text-white/95 active:scale-95 active:translate-y-0"
                  >
                    {aiSites[id]?.displayName || id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
