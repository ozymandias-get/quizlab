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
      {label && <span className="text-ql-11 text-muted-foreground ml-1 font-medium">{label}</span>}

      <Popover className="relative w-full">
        {({ open }) => (
          <>
            <PopoverButton
              className={`group focus-visible:ring-ring/40 flex w-full items-center gap-3 rounded-xl border p-1.5 transition-colors outline-none focus-visible:ring-2 ${
                open
                  ? 'border-primary/40 bg-muted shadow-xs'
                  : 'border-border bg-card hover:bg-muted/60'
              } `}
            >
              <div
                className="border-border/80 h-8 w-8 rounded-lg border shadow-xs"
                style={swatchStyle}
              />
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-ql-12 text-foreground font-mono font-medium">{color}</span>
              </div>
            </PopoverButton>

            <Transition
              as={Fragment}
              enter="transition ease-out motion-normal"
              enterFrom="opacity-0 translate-y-1 scale-98"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="transition ease-in motion-fast"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-1 scale-98"
            >
              <PopoverPanel className="z-overlay absolute bottom-full left-0 mb-3 outline-none">
                <div className="border-border bg-popover text-popover-foreground shadow-ambient-xl rounded-xl border p-3.5">
                  <div className="custom-color-picker">
                    <HexColorPicker color={color} onChange={onChange} />
                  </div>

                  <div className="mt-3 flex items-center gap-3 px-1">
                    <div
                      className="border-border/80 h-7 w-7 rounded-lg border shadow-xs"
                      style={swatchStyle}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-ql-10 text-muted-foreground font-medium">
                        {t('value')}
                      </span>
                      <span className="text-ql-12 text-foreground truncate font-mono">{color}</span>
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
