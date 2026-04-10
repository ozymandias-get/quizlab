import { type ReactNode } from 'react'
import { cn } from '@shared/lib/uiUtils'

interface StatusChipProps {
  label: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  className?: string
}

export const StatusChip = ({ label, variant = 'default', className = '' }: StatusChipProps) => {
  const variantClasses = {
    default:
      'border-white/[0.12] text-white/72 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]',
    success:
      'border-emerald-400/25 text-emerald-200 bg-[linear-gradient(145deg,rgba(16,185,129,0.18),rgba(255,255,255,0.03))]',
    warning:
      'border-amber-400/25 text-amber-100 bg-[linear-gradient(145deg,rgba(245,158,11,0.18),rgba(255,255,255,0.03))]',
    error:
      'border-red-400/25 text-red-100 bg-[linear-gradient(145deg,rgba(248,113,113,0.18),rgba(255,255,255,0.03))]',
    info: 'border-sky-400/25 text-sky-100 bg-[linear-gradient(145deg,rgba(56,189,248,0.18),rgba(255,255,255,0.03))]'
  }

  return (
    <span
      className={cn(
        'glass-tier-3 glass-tier-control inline-flex items-center justify-center px-2.5 py-1 text-ql-10 font-semibold tracking-wide uppercase shadow-none',
        variantClasses[variant],
        className
      )}
    >
      {label}
    </span>
  )
}
