import { cn } from '@shared/lib/uiUtils'

import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  return (
    <div
      role="status"
      aria-label={ariaLabel ?? t('loading')}
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        SPINNER_SIZES[size],
        className
      )}
    />
  )
}

export { InlineSpinner }
