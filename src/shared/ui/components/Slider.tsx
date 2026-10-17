import { cn } from '@shared/lib/uiUtils'

import * as SliderPrimitive from '@radix-ui/react-slider'
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react'

const Slider = forwardRef<
  ElementRef<typeof SliderPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none items-center select-none', className)}
    {...props}
  >
    <SliderPrimitive.Track className="bg-secondary relative h-1.5 w-full grow overflow-hidden rounded-full">
      <SliderPrimitive.Range
        className="absolute h-full"
        style={{ backgroundColor: 'var(--selection-color-source, oklch(var(--primary)))' }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="bg-background ring-offset-background focus-visible:ring-ring block h-4 w-4 cursor-pointer rounded-full border-2 shadow-xs transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      style={{ borderColor: 'var(--selection-color-source, oklch(var(--primary)))' }}
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export default Slider
