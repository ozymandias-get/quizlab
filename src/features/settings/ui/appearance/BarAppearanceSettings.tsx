import { memo } from 'react'
import { motion } from 'framer-motion'
import { SliderIcon } from '@ui/components/Icons'
import { Slider } from '@ui/components/Slider'

interface BarAppearanceSettingsProps {
    bottomBarOpacity: number;
    setBottomBarOpacity: (val: number) => void;
    bottomBarScale: number;
    setBottomBarScale: (val: number) => void;
    t: (key: string) => string;
}

const BarAppearanceSettings = memo(({
    bottomBarOpacity,
    setBottomBarOpacity,
    bottomBarScale,
    setBottomBarScale,
    t
}: BarAppearanceSettingsProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-[20px] bg-white/[0.02] border border-white/[0.05] space-y-6"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/[0.04] text-white/30 border border-white/[0.06]">
                    <SliderIcon className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white/90">{t('bar_appearance')}</h3>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">{t('opacity_scale')}</p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-white/70">Opacity</span>
                    <span className="text-white/40">{Math.round(bottomBarOpacity * 100)}%</span>
                </div>
                <Slider
                    min={0.1}
                    max={1.0}
                    step={0.01}
                    value={[bottomBarOpacity]}
                    onValueChange={(vals) => setBottomBarOpacity(vals[0])}
                />
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-white/70">Scale</span>
                    <span className="text-white/40">x{bottomBarScale.toFixed(2)}</span>
                </div>
                <Slider
                    min={0.7}
                    max={1.3}
                    step={0.01}
                    value={[bottomBarScale]}
                    onValueChange={(vals) => setBottomBarScale(vals[0])}
                />
            </div>
        </motion.div>
    )
})

BarAppearanceSettings.displayName = 'BarAppearanceSettings'
export default BarAppearanceSettings

