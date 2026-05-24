import { memo, useState } from 'react'
import { ChevronDown, Layers3 } from 'lucide-react'
import { useAppearance, useLanguageStrings } from '@app/providers'
import type { Tab } from '@app/providers/AiContext'
import type { AiSiteMap } from '../../../model/home'
import { OpenTabCard } from './OpenTabCard'

interface OpenTabsToggleProps {
  activeTabId: string
  aiSites: AiSiteMap
  onSelectTab: (tabId: string) => void
  tabs: Tab[]
}

export const OpenTabsToggle = memo<OpenTabsToggleProps>(function OpenTabsToggle({
  activeTabId,
  aiSites,
  onSelectTab,
  tabs
}: OpenTabsToggleProps) {
  const { t } = useLanguageStrings()
  const [isOpen, setIsOpen] = useState(false)
  const performanceMode = useAppearance((s) => s.performanceMode)
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const animate = !performanceMode && !prefersReducedMotion
  const hasTabs = (tabs || []).length > 0

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition-all hover:border-white/12 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.03] text-white/45">
          <Layers3 className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-ql-13 font-medium text-white/65">
            {(tabs || []).length} {t('ai_home.open_tab')}
          </div>
        </div>
        <div
          className="flex h-5 w-5 items-center justify-center text-white/35 transition-transform"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transitionDuration: animate ? '200ms' : '0ms',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <ChevronDown className="h-3 w-3" />
        </div>
      </button>

      <div
        className="overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: isOpen && hasTabs ? '1fr' : '0fr',
          opacity: isOpen && hasTabs ? 1 : 0,
          transition: animate
            ? 'grid-template-rows 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 160ms ease-out'
            : 'none'
        }}
      >
        <div className="min-h-0">
          {isOpen && hasTabs ? (
            <div className="grid gap-1.5 pb-1">
              {tabs.map((tab, index) => (
                <OpenTabCard
                  key={tab.id}
                  index={index}
                  isActive={tab.id === activeTabId}
                  modelId={tab.modelId}
                  onClick={() => onSelectTab(tab.id)}
                  site={aiSites[tab.modelId]}
                  tabId={tab.id}
                  title={tab.title}
                />
              ))}
            </div>
          ) : (
            <div className="pointer-events-none invisible" aria-hidden>
              {hasTabs && (
                <div className="grid gap-1.5 pb-1">
                  {tabs.map((tab, index) => (
                    <OpenTabCard
                      key={tab.id}
                      index={index}
                      isActive={tab.id === activeTabId}
                      modelId={tab.modelId}
                      onClick={() => onSelectTab(tab.id)}
                      site={aiSites[tab.modelId]}
                      tabId={tab.id}
                      title={tab.title}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
