import { useAppearance } from '@app/providers'
import { SettingsTabIcon, SettingsTabIntro } from '@shared/ui/components/primitives'
import { EyeIcon } from '@ui/components/Icons'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import BarAppearanceSettings from './appearance/BarAppearanceSettings'
import SelectionColorSettings from './appearance/SelectionColorSettings'

const APPEARANCE_ICON = (
  <SettingsTabIcon>
    <EyeIcon className="h-5 w-5" />
  </SettingsTabIcon>
)

const AppearanceTab = memo(() => {
  const {
    bottomBarOpacity,
    setBottomBarOpacity,
    bottomBarScale,
    setBottomBarScale,
    selectionColor,
    setSelectionColor
  } = useAppearance(
    useShallow((s) => ({
      bottomBarOpacity: s.bottomBarOpacity,
      setBottomBarOpacity: s.setBottomBarOpacity,
      bottomBarScale: s.bottomBarScale,
      setBottomBarScale: s.setBottomBarScale,
      selectionColor: s.selectionColor,
      setSelectionColor: s.setSelectionColor
    }))
  )

  const { t, i18n } = useTranslation()
  const language = i18n.language

  return (
    <div className="space-y-6" data-app-locale={language}>
      <SettingsTabIntro icon={APPEARANCE_ICON} description={t('appearance_description')} />

      <div className="space-y-4">
        <BarAppearanceSettings
          bottomBarOpacity={bottomBarOpacity}
          setBottomBarOpacity={setBottomBarOpacity}
          bottomBarScale={bottomBarScale}
          setBottomBarScale={setBottomBarScale}
          t={t}
        />

        <SelectionColorSettings
          selectionColor={selectionColor}
          setSelectionColor={setSelectionColor}
          t={t}
        />
      </div>
    </div>
  )
})

AppearanceTab.displayName = 'AppearanceTab'

export default AppearanceTab
