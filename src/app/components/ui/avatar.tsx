import { cn } from '@shared/lib/uiUtils'

import * as AvatarPrimitive from '@radix-ui/react-avatar'
import * as React from 'react'

function Avatar({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: 'default' | 'sm' | 'lg'
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-white/[0.07] after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6',
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'text-ql-14 group-data-[size=sm]/avatar:text-ql-12 flex size-full items-center justify-center rounded-full bg-zinc-900 text-zinc-400',
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback }
