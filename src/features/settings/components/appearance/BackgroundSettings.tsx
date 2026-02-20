import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Switch, Field, Label } from '@headlessui/react'
import { PaletteIcon, ShuffleIcon } from '@src/components/ui/Icons'
import ColorPicker from '../ColorPicker'

interface BackgroundSettingsProps {
    bgType: 'solid' | 'animated';
    setBgType: (val: 'solid' | 'animated') => void;
    bgSolidColor: string;
    setBgSolidColor: (val: string) => void;
    bgAnimatedColors: string[];
    setBgAnimatedColors: (val: string[]) => void;
    bgRandomMode: boolean;
    setBgRandomMode: (val: boolean) => void;
    t: (key: string) => string;
}

const BackgroundSettings = memo(({
    bgType,
    setBgType,
    bgSolidColor,
    setBgSolidColor,
    bgAnimatedColors,
    setBgAnimatedColors,
    bgRandomMode,
    setBgRandomMode,
    t
}: BackgroundSettingsProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-5 rounded-[20px] bg-white/[0.02] border border-white/[0.05] space-y-5"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/[0.04] text-white/30 border border-white/[0.06]">
                        <PaletteIcon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-white/90">{t('background_settings')}</h3>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest">{t('bg_desc')}</p>
                    </div>
                </div>

                <div className="flex p-0.5 bg-white/[0.04] rounded-lg border border-white/[0.06]">
                    <button
                        onClick={() => setBgType('animated')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${bgType === 'animated' ? 'bg-white/[0.1] text-white shadow' : 'text-white/30 hover:text-white/60'}`}
                    >
                        {t('bg_animated')}
                    </button>
                    <button
                        onClick={() => setBgType('solid')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${bgType === 'solid' ? 'bg-white/[0.1] text-white shadow' : 'text-white/30 hover:text-white/60'}`}
                    >
                        {t('bg_solid')}
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {bgType === 'solid' ? (
                    <motion.div
                        key="solid-picker"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl"
                    >
                        <ColorPicker
                            label={t('select_color')}
                            color={bgSolidColor}
                            onChange={setBgSolidColor}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="animated-settings"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="space-y-4"
                    >
                        <Field
                            className={`
                                group flex items-center justify-between p-3 rounded-xl transition-all duration-300 border cursor-pointer
                                ${bgRandomMode
                                    ? 'bg-white/[0.06] border-white/[0.12]'
                                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                                }
                            `}
                            onClick={() => setBgRandomMode(!bgRandomMode)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg transition-all ${bgRandomMode ? 'bg-white/[0.1] text-white' : 'bg-white/[0.03] text-white/30'}`}>
                                    <ShuffleIcon className="w-4 h-4" />
                                </div>
                                <div>
                                    <Label className={`text-xs font-bold cursor-pointer ${bgRandomMode ? 'text-white' : 'text-white/50'}`}>
                                        {t('bg_random_mode')}
                                    </Label>
                                </div>
                            </div>
                            <Switch
                                checked={bgRandomMode}
                                onChange={setBgRandomMode}
                                className={`relative flex items-center h-5 w-9 cursor-pointer rounded-full p-0.5 transition-all duration-300 border ${bgRandomMode ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/[0.04] border-white/[0.08]'}`}
                            >
                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full ring-0 transition duration-300 ${bgRandomMode ? 'translate-x-4 bg-emerald-500' : 'translate-x-0 bg-white/20'}`} />
                            </Switch>
                        </Field>

                        {!bgRandomMode && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="grid grid-cols-3 gap-3"
                            >
                                {bgAnimatedColors.map((color, index) => (
                                    <div key={index} className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                                        <ColorPicker
                                            color={color}
                                            onChange={(newColor) => {
                                                const newColors = [...bgAnimatedColors]
                                                newColors[index] = newColor
                                                setBgAnimatedColors(newColors)
                                            }}
                                        />
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
})

BackgroundSettings.displayName = 'BackgroundSettings'
export default BackgroundSettings
