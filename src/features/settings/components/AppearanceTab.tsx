import { memo } from 'react'
import { useAppearance, useLanguage } from '@src/app/providers'
import { EyeIcon } from '@src/components/ui/Icons'

import CompactModeToggle from './appearance/CompactModeToggle'
import BarAppearanceSettings from './appearance/BarAppearanceSettings'
import SelectionColorSettings from './appearance/SelectionColorSettings'
import BackgroundSettings from './appearance/BackgroundSettings'

const AppearanceTab = memo(() => {
    const {
        showOnlyIcons, setShowOnlyIcons,
        bottomBarOpacity, setBottomBarOpacity,
        bottomBarScale, setBottomBarScale,
        bgType, setBgType,
        bgSolidColor, setBgSolidColor,
        bgAnimatedColors, setBgAnimatedColors,
        bgRandomMode, setBgRandomMode,
        selectionColor, setSelectionColor
    } = useAppearance()

    const { t } = useLanguage()

    return (
        <div className="space-y-6">
            <header className="px-1 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 text-pink-400 border border-pink-500/20">
                        <EyeIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">
                            {t('visual_settings')}
                        </p>
                        <h4 className="text-sm font-bold text-white/90 tracking-wide">
                            {t('appearance_settings')}
                        </h4>
                    </div>
                </div>
            </header>

            <div className="px-1">
                <p className="text-xs text-white/40 leading-relaxed">
                    {t('appearance_description')}
                </p>
            </div>

            <CompactModeToggle
                showOnlyIcons={showOnlyIcons}
                setShowOnlyIcons={setShowOnlyIcons}
                t={t}
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
