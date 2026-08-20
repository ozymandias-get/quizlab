import { cn } from '@shared/lib/uiUtils'

interface InlineSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  'aria-label'?: string
}

const SPINNER_SIZES = {
  xs: 'size-3',
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
  xl: 'size-8'
} as const

function InlineSpinner({ size = 'sm', className, 'aria-label': ariaLabel }: InlineSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel ?? 'loading'}
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        SPINNER_SIZES[size],
        className
      )}
    />
  )
}

export { InlineSpinner }
