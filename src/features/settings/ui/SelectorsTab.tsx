import { SettingsTabIcon, SettingsTabIntro } from '@shared/ui/components/primitives'
import { SelectorIcon } from '@ui/components/Icons'

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
    aiEntries,
    selectors,
    expandedIds,
    validationState,
    tabs,
    currentAI,
    hasContent,
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

      <SelectorsList
        aiEntries={aiEntries}
        selectors={selectors}
        expandedIds={expandedIds}
        validationState={validationState}
        tabs={tabs}
        currentAI={currentAI}
        hasContent={hasContent}
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
