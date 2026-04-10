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
      className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_24px_64px_-16px_rgba(0,0,0,0.6)] backdrop-blur-2xl backdrop-saturate-200 sm:p-5"
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
                accent="#7c8cff"
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

        <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-4 backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] sm:px-5">
          <div className={`flex gap-4 ${isCompact ? 'flex-col' : 'flex-row items-stretch'}`}>
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
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
              className={`shrink-0 bg-white/[0.06] ${isCompact ? 'h-px w-full' : 'hidden w-px self-stretch sm:block'}`}
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
                    className="rounded-full border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent px-3.5 py-1.5 text-ql-12 text-white/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-300 ease-out hover:border-white/20 hover:bg-white/[0.12] hover:text-white/95 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 active:scale-95 active:translate-y-0"
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
