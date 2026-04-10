import { type ElementType } from 'react'

interface IconBadgeProps {
  icon: ElementType
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  iconClassName?: string
}

export const IconBadge = ({
  icon: Icon,
  variant = 'primary',
  size = 'md',
  className = '',
  iconClassName = ''
}: IconBadgeProps) => {
  const sizeClasses = {
    sm: 'w-6 h-6 rounded-md',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-2xl',
    xl: 'w-16 h-16 rounded-3xl'
  }

  const iconSizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8'
  }

  const variantClasses = {
    primary: 'bg-primary/10 text-primary border border-primary/20',
    success: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    danger: 'bg-red-500/10 text-red-500 border border-red-500/20',
    info: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    ghost: 'bg-white/5 text-white/70 border border-white/10'
  }

  return (
    <div
      className={`shrink-0 flex items-center justify-center ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      <Icon className={`${iconSizeClasses[size]} ${iconClassName}`} />
    </div>
  )
}
