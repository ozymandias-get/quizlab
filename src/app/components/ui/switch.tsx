import { cn } from '@shared/lib/uiUtils'

import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as React from 'react'

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default'
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=unchecked]:bg-input/90 focus-visible:ring-ring/70 relative inline-flex shrink-0 items-center rounded-full border-2 transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 aria-invalid:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-5 data-[size=default]:w-8 data-[size=sm]:h-4 data-[size=sm]:w-6 data-[state=unchecked]:border-transparent',
        className
      )}
      {...props}
    >
      {/* Non-colour state cue: "I" reads on the filled track, "O" on the
          empty one. The thumb paints above both glyphs. */}
      <span
        aria-hidden
        className="text-primary-foreground/80 pointer-events-none absolute top-1/2 left-1 -translate-y-1/2 text-[7px] leading-none font-bold opacity-0 transition-opacity group-data-[state=checked]/switch:opacity-100"
      >
        I
      </span>
      <span
        aria-hidden
        className="text-muted-foreground/70 pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 text-[7px] leading-none font-bold opacity-0 transition-opacity group-data-[state=unchecked]/switch:opacity-100"
      >
        O
      </span>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground pointer-events-none block rounded-full shadow-sm ring-0 transition-transform not-dark:bg-clip-padding group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-4px)] data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
