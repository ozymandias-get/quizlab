import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { type CSSProperties, Fragment, memo, useMemo } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useTranslation } from 'react-i18next'

interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
  label?: string
}

/** Accessible color popover (Headless UI + react-colorful). */
const ColorPicker = memo(({ color, onChange, label }: ColorPickerProps) => {
  const { t } = useTranslation()

  const swatchStyle = useMemo<CSSProperties>(() => ({ backgroundColor: color }), [color])

  return (
    <div className="relative flex flex-col gap-2">
      {label && (
        <span className="text-ql-11 tracking-ql-fine ml-1 font-medium text-white/36">{label}</span>
      )}

      <Popover className="relative w-full">
        {({ open }) => (
          <>
            <PopoverButton
              className={`group flex w-full items-center gap-3 rounded-2xl border p-1.5 transition-colors transition-shadow duration-200 outline-none ${
                open
                  ? 'border-white/20 bg-white/[0.08] shadow-lg'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
              } `}
            >
              <div
                className="h-8 w-8 rounded-xl border border-black/20 shadow-inner"
                style={swatchStyle}
              />
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-ql-12 tracking-ql-fine font-mono font-medium text-white/60">
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
              <PopoverPanel className="z-overlay absolute bottom-full left-0 mb-4 outline-none">
                <div className="rounded-[24px] border border-white/10 bg-zinc-900 p-4 shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                  <div className="custom-color-picker">
                    <HexColorPicker color={color} onChange={onChange} />
                  </div>

                  <div className="mt-4 flex items-center gap-3 px-1">
                    <div
                      className="h-8 w-8 rounded-xl border border-white/10 shadow-lg"
                      style={swatchStyle}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-ql-10 tracking-ql-fine font-medium text-white/40">
                        {t('value')}
                      </span>
                      <span className="text-ql-12 truncate font-mono text-white/80">{color}</span>
                    </div>
                  </div>
                </div>
              </PopoverPanel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  )
})

ColorPicker.displayName = 'ColorPicker'

export default ColorPicker
