import { cn } from '@app/lib/appUtils'

import * as React from 'react'

import { MenuSurface } from './menu'

interface InlineSelectorProps {
  open: boolean
  onClose: () => void
  closeLabel: string
  trigger: React.ReactNode
  popupClassName?: string
  children: React.ReactNode
}

function InlineSelector({
  open,
  onClose,
  closeLabel,
  trigger,
  popupClassName,
  children
}: InlineSelectorProps) {
  return (
    <>
      {trigger}
      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label={closeLabel}
            className="fixed inset-0 z-10 cursor-default"
            onClick={onClose}
          />
          <MenuSurface
            className={cn(
              'animate-in fade-in zoom-in-98 motion-normal absolute bottom-full left-0 mb-2 flex flex-col p-1.5',
              popupClassName
            )}
          >
            {children}
          </MenuSurface>
        </>
      )}
    </>
  )
}

export { InlineSelector }
