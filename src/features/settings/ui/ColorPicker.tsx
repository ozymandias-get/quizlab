import { cn } from '@shared/lib/uiUtils'

import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { type CSSProperties, Fragment, memo, useMemo } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useTranslation } from 'react-i18next'

/**
 * Quick-pick palette shown above the custom picker. These are deliberately
 * spread across the hue wheel so the five most common accent choices are one
 * click away; anything else still goes through the free-form picker.
 */
const PRESET_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'] as const

interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
  label?: string
}

/** Accessible color popover (Headless UI + react-colorful). */
const ColorPicker = memo(({ color, onChange, label }: ColorPickerProps) => {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()

  const swatchStyle = useMemo<CSSProperties>(() => ({ backgroundColor: color }), [color])
  const normalizedColor = color.toLowerCase()

  return (
    <div className="border-border/60 bg-background/40 flex flex-col gap-3 rounded-xl border p-4">
      {label && (
        <div className="text-muted-foreground flex items-center gap-2">
          <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold uppercase">
            {label}
          </span>
          <span aria-hidden className="bg-border h-px flex-1" />
        </div>
      )}

      {/* Round swatch dots: the selected one carries a check and gently grows. */}
      <div className="flex flex-wrap items-center gap-2.5">
        {PRESET_COLORS.map((preset) => {
          const isSelected = preset.toLowerCase() === normalizedColor
          return (
            <motion.button
              key={preset}
              type="button"
              aria-label={`${t('select_color')} ${preset}`}
              aria-pressed={isSelected}
              onClick={() => onChange(preset)}
              style={{ backgroundColor: preset }}
              animate={{ scale: isSelected ? 1.12 : 1 }}
              whileHover={prefersReducedMotion ? undefined : { scale: isSelected ? 1.16 : 1.08 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              className={cn(
                'focus-visible:ring-ring/70 relative flex size-7 shrink-0 items-center justify-center rounded-full transition-shadow outline-none focus-visible:ring-2',
                isSelected
                  ? 'ring-ring ring-offset-background ring-2 ring-offset-2'
                  : 'ring-border/60 ring-1 hover:ring-2'
              )}
            >
              {isSelected && (
                <Check
                  aria-hidden
                  strokeWidth={3}
                  className="size-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
                />
              )}
            </motion.button>
          )
        })}
      </div>

      <Popover className="relative w-full">
        {({ open }) => (
          <>
            <PopoverButton
              className={cn(
                'focus-visible:ring-ring/70 flex w-full items-center gap-3 rounded-lg border p-1.5 transition-colors outline-none focus-visible:ring-2',
                open ? 'border-ring/50 bg-accent/30' : 'border-border/60 bg-card hover:bg-muted/50'
              )}
            >
              <span
                aria-hidden
                className="border-border/60 h-8 w-8 shrink-0 rounded-lg border shadow-xs"
                style={swatchStyle}
              />
              <span className="text-ql-12 text-foreground truncate font-mono font-medium">
                {color}
              </span>
            </PopoverButton>

            <Transition
              as={Fragment}
              enter="transition ease-out motion-normal"
              enterFrom="opacity-0 translate-y-1 scale-[0.98]"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="transition ease-in motion-fast"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-1 scale-[0.98]"
            >
              <PopoverPanel className="z-overlay absolute bottom-full left-0 mb-3 outline-none">
                <div className="border-border bg-popover text-popover-foreground shadow-ambient-xl rounded-xl border p-3.5">
                  <div className="custom-color-picker">
                    <HexColorPicker color={color} onChange={onChange} />
                  </div>

                  <div className="border-border/60 mt-3 flex items-center justify-between gap-3 border-t pt-2.5">
                    <span className="text-ql-10 text-muted-foreground tracking-ql-label shrink-0 font-semibold uppercase">
                      {t('value')}
                    </span>
                    <span className="text-ql-12 text-foreground truncate font-mono">{color}</span>
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
