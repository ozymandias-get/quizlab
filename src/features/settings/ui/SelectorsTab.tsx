import { ChevronRightIcon, MagicWandIcon, SelectorIcon } from '@ui/components/Icons'

import { memo } from 'react'

import SelectorsList from './selectors/components/SelectorsList'
import { useSelectorsTabController } from './selectors/hooks/useSelectorsTabController'
import type { SelectorsTabProps } from './selectors/types'
import SettingsTabIntro from './shared/SettingsTabIntro'

const SELECTORS_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-xl border p-2.5">
    <SelectorIcon className="h-5 w-5" />
  </div>
)

const SelectorsTab = memo(({ onCloseSettings }: SelectorsTabProps) => {
  const controller = useSelectorsTabController({ onCloseSettings })
  const {
    t,
    handleStartTutorial,
    aiEntries,
    selectors,
    expandedIds,
    validationState,
    tabs,
    currentAI,
    hasWebview,
    isSaving,
    isDeleting,
    isTesting,
    handleToggleExpanded,
    handleOpenRepick,
    handleSubmitModeChange,
    handleTestSelectors,
    handleDeleteSelectors
  } = controller

  return (
    <div className="space-y-6 pb-20">
      <SettingsTabIntro
        icon={SELECTORS_ICON}
        eyebrow={t('automation')}
        title={t('element_selectors')}
        description={t('selectors_description_simple')}
      />

      <div className="mb-4 px-1">
        <button
          type="button"
          onClick={handleStartTutorial}
          className="group border-border bg-card hover:border-border/80 hover:bg-muted/60 focus-visible:ring-ring/40 flex w-full items-center gap-4 rounded-xl border p-4 shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <div className="border-primary/20 bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-105">
            <MagicWandIcon className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h4 className="text-foreground text-sm font-semibold transition-colors">
              {t('tutorial_button_title')}
            </h4>
            <p className="text-muted-foreground text-xs transition-colors">
              {t('tutorial_button_desc')}
            </p>
          </div>
          <div className="text-muted-foreground ml-auto opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <ChevronRightIcon className="h-5 w-5" />
          </div>
        </button>
      </div>

      <SelectorsList
        aiEntries={aiEntries}
        selectors={selectors}
        expandedIds={expandedIds}
        validationState={validationState}
        tabs={tabs}
        currentAI={currentAI}
        hasWebview={hasWebview}
        isSaving={isSaving}
        isDeleting={isDeleting}
        isTesting={isTesting}
        onToggleExpanded={handleToggleExpanded}
        onOpenRepick={handleOpenRepick}
        onSubmitModeChange={handleSubmitModeChange}
        onTestSelectors={handleTestSelectors}
        onDeleteSelectors={handleDeleteSelectors}
        t={t}
      />
    </div>
  )
})

SelectorsTab.displayName = 'SelectorsTab'

export default SelectorsTab
