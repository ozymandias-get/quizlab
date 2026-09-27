import { cn } from '@shared/lib/uiUtils'

import { memo } from 'react'

interface StepIndicatorProps {
  total: number
  step: number
  success: boolean
}

function StepIndicator({ total, step, success }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-6 pt-5 pb-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'motion-slower bg-muted h-1 flex-1 overflow-hidden rounded-full transition-colors',
            i <= (success ? step : step - 1) && 'bg-primary/70'
          )}
        />
      ))}
    </div>
  )
}

export default memo(StepIndicator)
