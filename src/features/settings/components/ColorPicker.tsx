import React from 'react'
import { HexColorPicker } from 'react-colorful'
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { useLanguage } from '@src/app/providers'
import { Fragment } from 'react'

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    label?: string;
}

/**
 * Premium Color Picker Component
 * Uses Headless UI for accessible popover management
 */
const ColorPicker = React.memo(({ color, onChange, label }: ColorPickerProps) => {
    const { t } = useLanguage()

    return (
        <div className="relative flex flex-col gap-2">
            {label && (
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-bold ml-1">
                    {label}
                </span>
            )}

            <Popover className="relative w-full">
                {({ open }) => (
                    <>
                        <PopoverButton
                            className={`
                                w-full group flex items-center gap-3 p-1.5 rounded-2xl border transition-all duration-300 outline-none
                                ${open
                                    ? 'bg-white/[0.08] border-white/20 shadow-lg'
                                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
                                }
                            `}
                        >
                            <div
                                className="w-8 h-8 rounded-xl shadow-inner border border-black/20"
                                style={{ backgroundColor: color }}
                            />
                            <div className="flex flex-col items-start gap-0.5">
                                <span className="text-[11px] font-mono text-white/60 uppercase tracking-widest font-medium">
                                    {color}
                                </span>
                            </div>
                        </PopoverButton>

                        <Transition
                            as={Fragment}
                            enter="transition ease-out duration-200"
                            enterFrom="opacity-0 translate-y-2 scale-95"
                            enterTo="opacity-100 translate-y-0 scale-100"
                            leave="transition ease-in duration-150"
                            leaveFrom="opacity-100 translate-y-0 scale-100"
                            leaveTo="opacity-0 translate-y-2 scale-95"
                        >
                            <PopoverPanel className="absolute left-0 bottom-full mb-4 z-[100] outline-none">
                                <div className="bg-[#121212] p-4 rounded-[24px] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
                                    <div className="custom-color-picker">
                                        <HexColorPicker color={color} onChange={onChange} />
                                    </div>

                                    <div className="mt-4 flex items-center gap-3 px-1">
                                        <div
                                            className="w-8 h-8 rounded-xl border border-white/10 shadow-lg"
                                            style={{ backgroundColor: color }}
                                        />
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-[10px] text-white/40 uppercase font-black tracking-tighter">{t('value')}</span>
                                            <span className="text-sm font-mono text-white/80 uppercase truncate">{color}</span>
                                        </div>
                                    </div>
                                </div>
                            </PopoverPanel>
                        </Transition>
                    </>
                )}
            </Popover>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-color-picker .react-colorful {
                    width: 200px !important;
                    height: 180px !important;
                    border-radius: 16px;
                }
                .custom-color-picker .react-colorful__saturation {
                    border-radius: 12px 12px 0 0;
                    border-bottom: 2px solid rgba(0,0,0,0.3);
                }
                .custom-color-picker .react-colorful__hue {
                    height: 12px !important;
                    border-radius: 0 0 12px 12px;
                    margin-top: 10px;
                }
                .custom-color-picker .react-colorful__pointer {
                    width: 16px !important;
                    height: 16px !important;
                    border: 2px solid white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                }
            `}} />
        </div>
    )
})

ColorPicker.displayName = 'ColorPicker'

export default ColorPicker

