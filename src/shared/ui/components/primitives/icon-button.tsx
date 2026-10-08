import * as React from 'react'

import { Button } from './button'

export type IconButtonSize = 'compact' | 'default'

interface IconButtonProps extends Omit<React.ComponentProps<typeof Button>, 'size'> {
  size?: IconButtonSize
  variant?: React.ComponentProps<typeof Button>['variant']
}

function IconButton({ size = 'default', variant, ...props }: IconButtonProps) {
  return <Button size={size === 'compact' ? 'icon-sm' : 'icon'} variant={variant} {...props} />
}

export { IconButton }
