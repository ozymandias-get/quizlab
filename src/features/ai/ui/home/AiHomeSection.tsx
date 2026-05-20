import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAppearance } from '@app/providers'

interface AiHomeSectionProps {
  accent: string
  children: ReactNode
  defaultOpen?: boolean
  delay?: number
  detail: string
  icon: ReactNode
  title: string
}

export default function AiHomeSection({
  children,
  defaultOpen = true,
  detail,
  icon,
  title
}: AiHomeSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const performanceMode = useAppearance((s) => s.performanceMode)
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const animate = !performanceMode && !prefersReducedMotion

  return (
    <section>
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer select-none items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.03] text-white/55">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ql-12 font-medium tracking-tight text-white/65">{title}</div>
          <div className="mt-0.5 text-ql-12 text-white/40">{detail}</div>
        </div>
        <div
          className="flex h-6 w-6 items-center justify-center text-white/40 transition-transform"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transitionDuration: animate ? '200ms' : '0ms',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </button>

      <div
        className="overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          opacity: isOpen ? 1 : 0,
          transition: animate
            ? 'grid-template-rows 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 160ms ease-out'
            : 'none'
        }}
      >
        <div className="min-h-0 px-1">
          {isOpen ? (
            <div className="pt-3 pb-1">{children}</div>
          ) : (
            <div className="pointer-events-none invisible" aria-hidden>
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
