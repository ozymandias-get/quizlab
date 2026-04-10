import { type ReactNode } from 'react'

interface StatusChipProps {
  label: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  className?: string
}

export const StatusChip = ({ label, variant = 'default', className = '' }: StatusChipProps) => {
  const variantClasses = {
    default: 'bg-white/10 text-white/70 border border-white/5',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    error: 'bg-red-500/15 text-red-400 border border-red-500/20',
    info: 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
  }

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-ql-10 font-semibold tracking-wide uppercase ${variantClasses[variant]} ${className}`}
    >
      {label}
    </span>
  )
}
