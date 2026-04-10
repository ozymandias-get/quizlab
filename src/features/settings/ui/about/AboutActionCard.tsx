import { memo, type ReactNode } from 'react'
import { cn } from '@shared/lib/uiUtils'

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
      <div className="flex items-center gap-4">
        {leading}
        <div className={cn('space-y-1', bodyClassName)}>
          <h4 className={cn('text-ql-14 font-bold text-white', titleClassName)}>{title}</h4>
          <p className={cn('text-ql-12 text-white/40', descriptionClassName)}>{description}</p>
        </div>
      </div>

      {trailing}
    </>
  )

  const rootClassName = cn(
    'flex items-center justify-between rounded-[24px] border border-white/[0.12] bg-white/[0.04] p-5',
    interactive && 'transition-all duration-300',
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
