import * as React from 'react'

import { Button } from './button'

export type IconButtonSize = 'compact' | 'default'

export interface IconButtonProps extends Omit<React.ComponentProps<typeof Button>, 'size'> {
  size?: IconButtonSize
}

function IconButton({ size = 'default', ...props }: IconButtonProps) {
  return <Button size={size === 'compact' ? 'icon-sm' : 'icon'} {...props} />
}

export { IconButton }
