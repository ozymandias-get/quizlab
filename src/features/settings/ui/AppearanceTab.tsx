import { memo } from 'react'
import { useAppearance, useLanguage } from '@app/providers'
import { EyeIcon } from '@ui/components/Icons'

import CompactModeToggle from './appearance/CompactModeToggle'
import BarAppearanceSettings from './appearance/BarAppearanceSettings'
import SelectionColorSettings from './appearance/SelectionColorSettings'
import BackgroundSettings from './appearance/BackgroundSettings'
import SettingsTabIntro from './shared/SettingsTabIntro'

const AppearanceTab = memo(() => {
  const {
    showOnlyIcons,
    setShowOnlyIcons,
    bottomBarOpacity,
    setBottomBarOpacity,
    bottomBarScale,
    setBottomBarScale,
    bgType,
    setBgType,
    bgSolidColor,
    setBgSolidColor,
    bgAnimatedColors,
    setBgAnimatedColors,
    bgRandomMode,
    setBgRandomMode,
    selectionColor,
    setSelectionColor
  } = useAppearance()

  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <SettingsTabIntro
        icon={
          <div className="rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/20 to-rose-500/20 p-2.5 text-pink-400">
            <EyeIcon className="w-5 h-5" />
          </div>
        }
        eyebrow={t('visual_settings')}
        title={t('appearance_settings')}
        description={t('appearance_description')}
      />

      <CompactModeToggle showOnlyIcons={showOnlyIcons} setShowOnlyIcons={setShowOnlyIcons} t={t} />

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
        bgType={bgType as 'solid' | 'animated'}
        setBgType={setBgType}
        bgSolidColor={bgSolidColor}
        setBgSolidColor={setBgSolidColor}
        bgAnimatedColors={bgAnimatedColors}
        setBgAnimatedColors={setBgAnimatedColors}
        bgRandomMode={bgRandomMode}
        setBgRandomMode={setBgRandomMode}
        t={t}
      />
    </div>
  )
})

AppearanceTab.displayName = 'AppearanceTab'

export default AppearanceTab
