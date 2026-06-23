import { ChevronRightIcon, MagicWandIcon, SelectorIcon } from '@ui/components/Icons'

import { memo } from 'react'

import SelectorsList from './selectors/components/SelectorsList'
import { useSelectorsTabController } from './selectors/hooks/useSelectorsTabController'
import type { SelectorsTabProps } from './selectors/types'
import SettingsTabIntro from './shared/SettingsTabIntro'

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
        icon={
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-2.5 text-emerald-400">
            <SelectorIcon className="h-5 w-5" />
          </div>
        }
        eyebrow={t('automation')}
        title={t('element_selectors')}
        description={t('selectors_description_simple')}
      />

      <div className="mb-4 px-1">
        <button
          type="button"
          onClick={handleStartTutorial}
          className="group flex w-full items-center gap-4 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 transition-colors hover:border-purple-500/40"
        >
          <div className="rounded-xl bg-purple-500/20 p-2.5 text-purple-400 transition-transform group-hover:scale-110">
            <MagicWandIcon className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h4 className="text-foreground text-sm font-bold transition-colors group-hover:text-purple-300">
              {t('tutorial_button_title')}
            </h4>
            <p className="text-muted-foreground group-hover:text-muted-foreground text-xs transition-colors">
              {t('tutorial_button_desc')}
            </p>
          </div>
          <div className="ml-auto text-purple-400 opacity-[0.55] transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
