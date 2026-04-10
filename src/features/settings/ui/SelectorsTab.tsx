import { memo } from 'react'
import { ChevronRightIcon, MagicWandIcon, SelectorIcon } from '@ui/components/Icons'
import SettingsTabIntro from './shared/SettingsTabIntro'
import SelectorsList from './selectors/components/SelectorsList'
import { useSelectorsTabController } from './selectors/hooks/useSelectorsTabController'
import type { SelectorsTabProps } from './selectors/types'

const SelectorsTab = memo(({ onCloseSettings }: SelectorsTabProps) => {
  const controller = useSelectorsTabController({ onCloseSettings })
  const { t } = controller

  return (
    <div className="space-y-6 pb-20">
      <SettingsTabIntro
        icon={
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-2.5 text-emerald-400">
            <SelectorIcon className="w-5 h-5" />
          </div>
        }
        eyebrow={t('automation')}
        title={t('element_selectors')}
        description={t('selectors_description_simple')}
      />

      <div className="mb-4 px-1">
        <button
          onClick={controller.handleStartTutorial}
          className="group flex w-full items-center gap-4 rounded-[20px] border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 transition-all hover:border-purple-500/40"
        >
          <div className="rounded-xl bg-purple-500/20 p-2.5 text-purple-400 transition-transform group-hover:scale-110">
            <MagicWandIcon className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h4 className="text-ql-14 font-bold text-white/90 transition-colors group-hover:text-purple-300">
              {t('tutorial_button_title')}
            </h4>
            <p className="text-ql-12 text-white/40 transition-colors group-hover:text-white/60">
              {t('tutorial_button_desc')}
            </p>
          </div>
          <div className="ml-auto text-purple-400 opacity-[0.55] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <ChevronRightIcon className="w-5 h-5" />
          </div>
        </button>
      </div>

      <SelectorsList
        aiEntries={controller.aiEntries}
        selectors={controller.selectors}
        expandedIds={controller.expandedIds}
        validationState={controller.validationState}
        tabs={controller.tabs}
        currentAI={controller.currentAI}
        webviewInstance={controller.webviewInstance}
        isSaving={controller.isSaving}
        isDeleting={controller.isDeleting}
        isTesting={controller.isTesting}
        onToggleExpanded={controller.toggleExpanded}
        onOpenRepick={controller.handleOpenRepick}
        onSubmitModeChange={controller.handleSubmitModeChange}
        onTestSelectors={controller.handleTestSelectors}
        onDeleteSelectors={controller.handleDeleteSelectors}
        t={t}
      />
    </div>
  )
})

SelectorsTab.displayName = 'SelectorsTab'

export default SelectorsTab
