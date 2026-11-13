import { MagicCard } from '@app/components/ui/magic-card'
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
  interactive?: boolean
}

const AboutActionCard = memo(function AboutActionCard({
  title,
  description,
  leading,
  trailing,
  href,
  rel,
  target,
  className,
  interactive = false
}: AboutActionCardProps) {
  const content = (
    <div className="flex min-w-0 items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {leading}
        <div className="min-w-0">
          <h4 className="text-ql-13 text-foreground truncate font-semibold">{title}</h4>
          <p className="text-ql-12 text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      {trailing}
    </div>
  )

  const card = (
    <MagicCard
      className={cn(
        'rounded-2xl border-white/10',
        interactive && 'transition-colors hover:bg-white/[0.02]',
        className
      )}
      gradientColor="#27272a"
      gradientOpacity={0.45}
      gradientFrom="#3f3f46"
      gradientTo="#27272a"
    >
      {content}
    </MagicCard>
  )

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className="focus-visible:ring-ring/70 block rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
      >
        {card}
      </a>
    )
  }

  return card
})

export default AboutActionCard
