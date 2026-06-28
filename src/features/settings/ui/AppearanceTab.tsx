import { useAppearance } from '@app/providers'
import { EyeIcon } from '@ui/components/Icons'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import BackgroundSettings from './appearance/BackgroundSettings'
import BarAppearanceSettings from './appearance/BarAppearanceSettings'
import SelectionColorSettings from './appearance/SelectionColorSettings'
import SettingsTabIntro from './shared/SettingsTabIntro'

const APPEARANCE_ICON = (
  <div className="border-accent/20 bg-accent/10 text-foreground rounded-lg border p-2.5">
    <EyeIcon className="h-5 w-5" />
  </div>
)

const AppearanceTab = memo(() => {
  const {
    bottomBarOpacity,
    setBottomBarOpacity,
    bottomBarScale,
    setBottomBarScale,
    bgMode,
    setBgMode,
    bgSolidColor,
    setBgSolidColor,
    selectionColor,
    setSelectionColor
  } = useAppearance(
    useShallow((s) => ({
      bottomBarOpacity: s.bottomBarOpacity,
      setBottomBarOpacity: s.setBottomBarOpacity,
      bottomBarScale: s.bottomBarScale,
      setBottomBarScale: s.setBottomBarScale,
      bgMode: s.bgMode,
      setBgMode: s.setBgMode,
      bgSolidColor: s.bgSolidColor,
      setBgSolidColor: s.setBgSolidColor,
      selectionColor: s.selectionColor,
      setSelectionColor: s.setSelectionColor
    }))
  )

  const { t, i18n } = useTranslation()
  const language = i18n.language

  return (
    <div className="space-y-6" data-app-locale={language}>
      <SettingsTabIntro
        icon={APPEARANCE_ICON}
        eyebrow={t('visual_settings')}
        title={t('appearance_settings')}
        description={t('appearance_description')}
      />

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

      <BackgroundSettings
        bgMode={bgMode}
        setBgMode={setBgMode}
        bgSolidColor={bgSolidColor}
        setBgSolidColor={setBgSolidColor}
        t={t}
      />
    </div>
  )
})

AppearanceTab.displayName = 'AppearanceTab'

export default AppearanceTab
