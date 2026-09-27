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
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {leading}
        <div className={cn('min-w-0', bodyClassName)}>
          <h4 className={cn('text-ql-13 text-foreground truncate font-semibold', titleClassName)}>
            {title}
          </h4>
          <p className={cn('text-ql-12 text-muted-foreground mt-0.5', descriptionClassName)}>
            {description}
          </p>
        </div>
      </div>

      {trailing}
    </>
  )

  const rootClassName = cn(
    'flex min-w-0 items-center justify-between gap-4 rounded-2xl border p-5',
    interactive
      ? 'border-border/60 bg-card transition-colors hover:bg-muted/50'
      : 'border-border/60 bg-card/30',
    'focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none',
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
