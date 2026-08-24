import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'

const InputGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="input-group"
        className={cn('relative flex w-full items-center', className)}
        {...props}
      />
    )
  }
)
InputGroup.displayName = 'InputGroup'

interface InputGroupAddonProps extends React.ComponentProps<'div'> {
  align?: 'inline-start' | 'inline-end'
}

const InputGroupAddon = React.forwardRef<HTMLDivElement, InputGroupAddonProps>(
  ({ className, align = 'inline-start', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="input-group-addon"
        data-align={align}
        className={cn(
          'text-muted-foreground pointer-events-none absolute flex items-center justify-center [&_svg]:size-3.5',
          align === 'inline-start' ? 'left-2.5' : 'right-2.5',
          className
        )}
        {...props}
      />
    )
  }
)
InputGroupAddon.displayName = 'InputGroupAddon'

export { InputGroup, InputGroupAddon }
