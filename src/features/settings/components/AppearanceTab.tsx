import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Switch, Field, Label, Description } from '@headlessui/react'
import { useAppearance, useLanguage } from '@src/app/providers'
import { EyeIcon, PaletteIcon, SliderIcon, SelectionIcon, ShuffleIcon } from '@src/components/ui/Icons'

import ColorPicker from './ColorPicker'
import Slider from '@src/components/ui/Slider'

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

            {/* Compact Mode Toggle */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Field
                    className={`
                        group flex items-center justify-between p-4 rounded-[20px] transition-all duration-300 border cursor-pointer
                        ${showOnlyIcons
                            ? 'bg-white/[0.06] border-white/[0.12] shadow-lg'
                            : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                        }
                    `}
                    onClick={() => setShowOnlyIcons(!showOnlyIcons)}
                >
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className={`
                                p-3 rounded-2xl border transition-all duration-300
                                ${showOnlyIcons
                                    ? 'bg-gradient-to-br from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400'
                                    : 'bg-white/[0.02] border-white/[0.06] text-white/20'
                                }
                            `}>
                                <EyeIcon className="w-5 h-5" />
                            </div>
                            {showOnlyIcons && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a0a0a] shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                />
                            )}
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-sm font-bold text-white">{t('show_only_icons')}</Label>
                            <Description className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
                                {t('show_only_icons_desc')}
                            </Description>
                        </div>
                    </div>
                    <Switch
                        checked={showOnlyIcons}
                        onChange={setShowOnlyIcons}
                        className={`
                            group relative flex items-center h-6 w-11 cursor-pointer rounded-full p-1 transition-all duration-300 border
                            ${showOnlyIcons ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/[0.04] border-white/[0.08]'}
                        `}
                    >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full ring-0 transition duration-300 shadow-lg ${showOnlyIcons ? 'translate-x-5 bg-emerald-500' : 'translate-x-0 bg-white/20'}`} />
                    </Switch>
                </Field>
            </motion.div>



            {/* Scale & Opacity Section */}
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

                <Slider
                    min={0.1}
                    max={1.0}
                    value={bottomBarOpacity}
                    onChange={setBottomBarOpacity}
                    label="Opacity"
                    displayValue={`${Math.round(bottomBarOpacity * 100)}%`}
                    className="space-y-3"
                />

                <Slider
                    min={0.7}
                    max={1.3}
                    value={bottomBarScale}
                    onChange={setBottomBarScale}
                    label="Scale"
                    displayValue={`x${bottomBarScale.toFixed(2)}`}
                    className="space-y-3"
                />
            </motion.div>

            {/* Selection & AI Color Section */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="p-5 rounded-[20px] bg-white/[0.02] border border-white/[0.05] space-y-5"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/[0.04] text-white/30 border border-white/[0.06]">
                        <SelectionIcon className="w-4 h-4" />

                    </div>
                    <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-white/90">{t('selection_color_settings')}</h3>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest">{t('selection_color_desc')}</p>
                    </div>
                </div>

                <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <ColorPicker
                        label={t('select_color')}
                        color={selectionColor}
                        onChange={setSelectionColor}
                    />
                    <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <div
                            className="w-10 h-6 rounded-md shadow-lg"
                            style={{ backgroundColor: selectionColor }}
                        />
                        <span className="text-[10px] text-white/40 font-medium">
                            {t('selection_color_preview_hint')}
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Background Section */}
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
                                        <Label className={`text-xs font-bold ${bgRandomMode ? 'text-white' : 'text-white/50'}`}>
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
        </div>
    )
})

AppearanceTab.displayName = 'AppearanceTab'

export default AppearanceTab

