import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Switch, RadioGroup, Radio, Field, Label, Description } from '@headlessui/react'
import { useAppearance, useLanguage } from '@src/app/providers'
import { EyeIcon } from '@src/components/ui/Icons'
import { BOTTOM_BAR_LAYOUTS } from '@src/constants/appearance'
import ColorPicker from './ColorPicker'

interface IconProps {
    className?: string;
}

// Icon components
const LayoutIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
)

const PaletteIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="10.5" r="2.5" />
        <circle cx="8.5" cy="7.5" r="2.5" />
        <circle cx="6.5" cy="12.5" r="2.5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
    </svg>
)

const SliderIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
)

/**
 * Görünüm (Appearance) Ayarları Sekmesi - Premium Redesign
 */
const AppearanceTab = React.memo(() => {
    const {
        showOnlyIcons,
        setShowOnlyIcons,
        bottomBarOpacity,
        setBottomBarOpacity,
        bottomBarScale,
        setBottomBarScale,
        bottomBarLayout,
        setBottomBarLayout,
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

    const layouts = useMemo(() => [
        { id: BOTTOM_BAR_LAYOUTS.HORIZONTAL, label: t('layout_horizontal') },
        { id: BOTTOM_BAR_LAYOUTS.VERTICAL, label: t('layout_vertical') }
    ], [t])

    return (
        <div className="space-y-6">
            {/* Header */}
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

            {/* Açıklama */}
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

            {/* Layout Section Updated */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="p-5 rounded-[20px] bg-white/[0.02] border border-white/[0.05] space-y-5"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/[0.04] text-white/30 border border-white/[0.06]">
                        <LayoutIcon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-white/90">{t('bar_layout')}</h3>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest">{t('bar_drag_hint')}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">{t('bar_layout_direction')}</span>
                    <RadioGroup value={bottomBarLayout} onChange={setBottomBarLayout} className="grid grid-cols-2 gap-2">
                        {layouts.map((layout) => (
                            <Radio
                                key={layout.id}
                                value={layout.id}
                                className={({ checked }) => `
                                    relative flex items-center justify-center p-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-300
                                    ${checked
                                        ? 'bg-white/[0.1] text-white border-white/30 shadow-lg'
                                        : 'bg-white/[0.02] border-white/[0.05] text-white/40 hover:bg-white/[0.04] hover:text-white/60'
                                    }
                                `}
                            >
                                {({ checked }) => (
                                    <>
                                        {layout.label}
                                        {checked && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-400"
                                            />
                                        )}
                                    </>
                                )}
                            </Radio>
                        ))}
                    </RadioGroup>
                </div>
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

                {/* Opacity Slider */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white/60">{t('opacity')}</span>
                        <span className="text-[10px] font-mono font-bold text-white bg-white/[0.08] px-2 py-0.5 rounded-md">
                            {Math.round(bottomBarOpacity * 100)}%
                        </span>
                    </div>
                    <div className="relative h-6 flex items-center group">
                        {(() => {
                            const min = 0.1;
                            const max = 1.0;
                            const percent = ((bottomBarOpacity - min) / (max - min)) * 100;
                            return (
                                <>
                                    <div className="absolute inset-0 h-1.5 my-auto w-full bg-white/[0.04] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-pink-500/50 to-pink-400 transition-all duration-150"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min={min}
                                        max={max}
                                        step="0.01"
                                        value={bottomBarOpacity}
                                        onChange={(e) => setBottomBarOpacity(parseFloat(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div
                                        className="absolute w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-transform duration-150 group-hover:scale-110"
                                        style={{ left: `${percent}%`, transform: `translateX(-50%)` }}
                                    />
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Scale Slider */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white/60">{t('scale')}</span>
                        <span className="text-[10px] font-mono font-bold text-white bg-white/[0.08] px-2 py-0.5 rounded-md">
                            x{bottomBarScale.toFixed(2)}
                        </span>
                    </div>
                    <div className="relative h-6 flex items-center group">
                        {(() => {
                            const min = 0.7;
                            const max = 1.3;
                            const percent = ((bottomBarScale - min) / (max - min)) * 100;
                            return (
                                <>
                                    <div className="absolute inset-0 h-1.5 my-auto w-full bg-white/[0.04] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-pink-500/50 to-pink-400 transition-all duration-150"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min={min}
                                        max={max}
                                        step="0.01"
                                        value={bottomBarScale}
                                        onChange={(e) => setBottomBarScale(parseFloat(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div
                                        className="absolute w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-transform duration-150 group-hover:scale-110"
                                        style={{ left: `${percent}%`, transform: `translateX(-50%)` }}
                                    />
                                </>
                            );
                        })()}
                    </div>
                </div>
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
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3L5.26 14.74A2 2 0 0 0 5 16.14V21h4.86a2 2 0 0 0 1.4-.59L23 8.68a2 2 0 0 0 0-2.83l-3.17-3.17a2 2 0 0 0-2.83 0z" />
                            <path d="M21 7l-4-4" />
                            <circle cx="7" cy="17" r="3" />
                        </svg>
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
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
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

