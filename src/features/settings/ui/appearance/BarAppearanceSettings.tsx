import { SliderIcon } from '@ui/components/Icons'
import Slider from '@ui/components/Slider'

import { motion } from 'motion/react'
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
      (vals: number[]) => setBottomBarOpacity(vals[0]),
      [setBottomBarOpacity]
    )
    const handleScaleChange = useCallback(
      (vals: number[]) => setBottomBarScale(vals[0]),
      [setBottomBarScale]
    )
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.05 }}
        className="bg-card border-border space-y-6 rounded-xl border p-5"
      >
        <div className="flex items-center gap-3">
          <div className="bg-muted text-muted-foreground/60 border-border rounded-lg border p-2">
            <SliderIcon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-ql-14 text-foreground font-bold">{t('bar_appearance')}</h3>
            <p className="text-ql-11 text-muted-foreground/70 tracking-ql-fine">
              {t('opacity_scale')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-ql-12 flex items-center justify-between font-medium">
            <span className="text-muted-foreground/80">Opacity</span>
            <span className="text-muted-foreground">{Math.round(bottomBarOpacity * 100)}%</span>
          </div>
          <Slider
            min={0.1}
            max={1.0}
            step={0.01}
            value={[bottomBarOpacity]}
            onValueChange={handleOpacityChange}
          />
        </div>

        <div className="space-y-3">
          <div className="text-ql-12 flex items-center justify-between font-medium">
            <span className="text-muted-foreground/80">Scale</span>
            <span className="text-muted-foreground">x{bottomBarScale.toFixed(2)}</span>
          </div>
          <Slider
            min={0.7}
            max={1.3}
            step={0.01}
            value={[bottomBarScale]}
            onValueChange={handleScaleChange}
          />
        </div>
      </motion.div>
    )
  }
)

BarAppearanceSettings.displayName = 'BarAppearanceSettings'
export default BarAppearanceSettings
