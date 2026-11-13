import { SettingsSection } from '@shared/ui/components/primitives'
import { SliderIcon } from '@ui/components/Icons'
import Slider from '@ui/components/Slider'

import { memo, useCallback } from 'react'

interface BarAppearanceSettingsProps {
  bottomBarOpacity: number
  setBottomBarOpacity: (val: number) => void
  bottomBarScale: number
  setBottomBarScale: (val: number) => void
  t: (key: string) => string
}

const BarAppearanceSettings = memo(
  ({
    bottomBarOpacity,
    setBottomBarOpacity,
    bottomBarScale,
    setBottomBarScale,
    t
  }: BarAppearanceSettingsProps) => {
    const handleOpacityChange = useCallback(
      (vals: number[]) => setBottomBarOpacity(vals[0] ?? 0.7),
      [setBottomBarOpacity]
    )
    const handleScaleChange = useCallback(
      (vals: number[]) => setBottomBarScale(vals[0] ?? 1),
      [setBottomBarScale]
    )
    return (
      <SettingsSection
        icon={<SliderIcon className="h-4 w-4" />}
        title={t('bar_appearance')}
        detail={t('opacity_scale')}
      >
        <div className="flex flex-col gap-2">
          <div className="text-ql-12 text-muted-foreground flex items-center justify-between">
            <span>{t('opacity')}</span>
            <span className="text-foreground tabular-nums">
              {Math.round(bottomBarOpacity * 100)}%
            </span>
          </div>
          <Slider
            min={0.1}
            max={1.0}
            step={0.01}
            value={[bottomBarOpacity]}
            onValueChange={handleOpacityChange}
            aria-label={t('opacity')}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-ql-12 text-muted-foreground flex items-center justify-between">
            <span>{t('scale')}</span>
            <span className="text-foreground tabular-nums">x{bottomBarScale.toFixed(2)}</span>
          </div>
          <Slider
            min={0.7}
            max={1.3}
            step={0.01}
            value={[bottomBarScale]}
            onValueChange={handleScaleChange}
            aria-label={t('scale')}
          />
        </div>
      </SettingsSection>
    )
  }
)

BarAppearanceSettings.displayName = 'BarAppearanceSettings'
export default BarAppearanceSettings
