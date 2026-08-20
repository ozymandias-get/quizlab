import { cn } from '@shared/lib/uiUtils'

import { memo, type ReactNode } from 'react'

interface AboutActionCardProps {
  title: string
  description: string
  leading?: ReactNode
  trailing?: ReactNode
  href?: string
  rel?: string
  target?: string
  className?: string
  bodyClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  interactive?: boolean
}

function AboutActionCard({
  title,
  description,
  leading,
  trailing,
  href,
  rel,
  target,
  className,
  bodyClassName,
  titleClassName,
  descriptionClassName,
  interactive = false
}: AboutActionCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-3.5">
        {leading}
        <div className={cn('space-y-0.5', bodyClassName)}>
          <h4 className={cn('text-ql-13 text-foreground font-semibold', titleClassName)}>
            {title}
          </h4>
          <p className={cn('text-ql-12 text-muted-foreground', descriptionClassName)}>
            {description}
          </p>
        </div>
      </div>

      {trailing}
    </>
  )

  const rootClassName = cn(
    'flex items-center justify-between rounded-xl border border-border bg-card p-4 min-w-0 shadow-xs',
    interactive && 'transition-colors motion-normal hover:bg-muted/40',
    'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
    className
  )

  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={rootClassName}>
        {content}
      </a>
    )
  }

  return <div className={rootClassName}>{content}</div>
}

export default memo(AboutActionCard)
