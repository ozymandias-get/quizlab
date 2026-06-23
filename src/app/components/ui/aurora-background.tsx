import { cn } from '@app/lib/utils'

interface AuroraBackgroundProps {
  className?: string
  showRadialGradient?: boolean
}

export function AuroraBackground({ className, showRadialGradient = true }: AuroraBackgroundProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={
        {
          '--aurora':
            'repeating-linear-gradient(100deg,#3b82f6_10%,#a5b4fc_15%,#93c5fd_20%,#ddd6fe_25%,#60a5fa_30%)',
          '--dark-gradient':
            'repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)',
          '--white-gradient':
            'repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)'
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          `pointer-events-none absolute -inset-[10px] [background-image:var(--white-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] opacity-50 blur-[10px] invert filter will-change-transform dark:[background-image:var(--dark-gradient),var(--aurora)] dark:invert-0`,

          showRadialGradient &&
            `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]`
        )}
      />
      <div
        aria-hidden
        className="animate-aurora pointer-events-none absolute top-0 bottom-0 left-0 w-[200%] [background-image:var(--white-gradient),var(--aurora)] [background-size:200%,_100%] mix-blend-difference will-change-transform dark:[background-image:var(--dark-gradient),var(--aurora)]"
      />
    </div>
  )
}
