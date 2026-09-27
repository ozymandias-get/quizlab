import { SettingsTabIcon, SettingsTabIntro } from '@shared/ui/components/primitives'
import { ChevronRightIcon, MagicWandIcon, SelectorIcon } from '@ui/components/Icons'

import { memo } from 'react'

import SelectorsList from './selectors/components/SelectorsList'
import { useSelectorsTabController } from './selectors/hooks/useSelectorsTabController'
import type { SelectorsTabProps } from './selectors/types'

const SELECTORS_ICON = (
  <SettingsTabIcon>
    <SelectorIcon className="h-5 w-5" />
  </SettingsTabIcon>
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
    <div className="space-y-6 pb-4">
      <SettingsTabIntro icon={SELECTORS_ICON} description={t('selectors_description_simple')} />

      <button
        type="button"
        onClick={handleStartTutorial}
        className="group border-border/60 bg-card hover:bg-muted/50 focus-visible:ring-ring/40 flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
        >
          <MagicWandIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-ql-13 text-foreground truncate font-semibold">
            {t('tutorial_button_title')}
          </h4>
          <p className="text-ql-12 text-muted-foreground mt-0.5 leading-relaxed">
            {t('tutorial_button_desc')}
          </p>
        </div>
        <ChevronRightIcon className="text-muted-foreground group-hover:text-foreground ml-auto h-4 w-4 shrink-0 transition-colors" />
      </button>

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
