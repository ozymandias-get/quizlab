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
  isNarrow,
  isUltraNarrow,
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
      className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015)_48%,rgba(0,0,0,0.16))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_34px_80px_-46px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-5"
    >
      <div className="flex flex-col gap-4">
        <div
          className={`flex gap-4 ${isCompact ? 'flex-col' : 'flex-row items-start justify-between'}`}
        >
          <div className={isCompact ? 'max-w-none' : 'max-w-2xl'}>
            <h1
              className={`font-semibold tracking-tight text-white/92 ${
                isUltraNarrow
                  ? 'text-[22px] leading-[1.18]'
                  : isNarrow
                    ? 'text-[26px] leading-[1.16]'
                    : 'text-[24px] sm:text-[30px]'
              }`}
            >
              {t('ai_home.title')}
            </h1>
            <p
              className={`mt-2.5 text-[13.5px] leading-relaxed text-white/48 ${isCompact ? 'max-w-none' : 'max-w-xl'} sm:text-[14.5px]`}
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

        <div className="rounded-[28px] border border-white/8 bg-black/20 p-4 backdrop-blur-xl sm:px-5">
          <div className={`flex gap-4 ${isCompact ? 'flex-col' : 'flex-row items-stretch'}`}>
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/65 shadow-sm">
                <Compass className="h-[17px] w-[17px]" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-white/84">
                  {activeTab
                    ? t('ai_home.active_ready_title', {
                        name: aiSites[activeTab.modelId]?.displayName || activeTab.modelId
                      })
                    : t('ai_home.home_state')}
                </div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-white/42">
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
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/32">
                {t('ai_home.featured')}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {featuredIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpenModel(id)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white/90"
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
