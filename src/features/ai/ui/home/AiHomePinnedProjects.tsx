import { BlurFade } from '@app/components/ui/blur-fade'
import { MagicCard } from '@app/components/ui/magic-card'
import { getAiIcon } from '@ui/components/Icons'

import { Link2, Pin, X } from 'lucide-react'
import { memo, type MouseEvent as ReactMouseEvent, Suspense, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { PinnedAiProject } from '../../lib/pinnedProjects'
import type { AiSiteMap } from '../../model/home'
import { safeAiAccentColor } from '../../model/home'

interface AiHomePinnedProjectsProps {
  aiSites: AiSiteMap
  projects: PinnedAiProject[]
  onOpen: (modelId: string, url: string) => void
  onRemove: (id: string) => void
}

const AiHomePinnedProjects = memo(function AiHomePinnedProjects({
  aiSites,
  projects,
  onOpen,
  onRemove
}: AiHomePinnedProjectsProps) {
  const { t } = useTranslation()
  const gridRef = useRef<HTMLDivElement>(null)

  const handleOpen = useCallback(
    (project: PinnedAiProject) => {
      onOpen(project.modelId, project.url)
    },
    [onOpen]
  )

  const handleRemove = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, id: string, index: number) => {
      // Mouse clicks should not cause an artificial focus jump.
      if (event.detail !== 0) {
        onRemove(id)
        return
      }
      const grid = gridRef.current
      const remainingCount = projects.length - 1
      // Capture the section toggle before `onRemove` unmounts this list on the last item.
      const sectionToggle =
        remainingCount === 0
          ? (grid?.closest('section')?.querySelector<HTMLButtonElement>('button[aria-expanded]') ??
            null)
          : null
      onRemove(id)
      requestAnimationFrame(() => {
        if (remainingCount > 0) {
          const targetIndex = Math.min(index, remainingCount - 1)
          gridRef.current
            ?.querySelectorAll<HTMLButtonElement>('[data-pinned-open]')
            [targetIndex]?.focus()
          return
        }
        sectionToggle?.focus()
      })
    },
    [onRemove, projects.length]
  )

  return (
    <div ref={gridRef} className="grid gap-2.5 sm:grid-cols-2">
      {projects.map((project, index) => {
        const site = aiSites[project.modelId]
        const accent = safeAiAccentColor(site?.color)
        const siteName = site?.displayName || site?.name || project.modelId
        const icon = getAiIcon(site?.icon || project.modelId)
        const letterFallback = (
          <span
            aria-hidden
            className="border-primary/20 from-primary/20 to-primary/5 text-primary text-ql-13 flex size-full items-center justify-center rounded-[inherit] border bg-gradient-to-br font-bold uppercase"
          >
            {project.name.charAt(0)}
          </span>
        )

        return (
          <div key={project.id} className="group relative rounded-xl">
            <BlurFade delay={index * 0.04} className="h-full">
              <MagicCard
                className="h-full rounded-xl"
                gradientColor="#18181b"
                gradientOpacity={0.35}
                gradientFrom="#27272a"
                gradientTo="#18181b"
              >
                <div className="relative">
                  <button
                    type="button"
                    data-pinned-open=""
                    onClick={() => handleOpen(project)}
                    aria-label={t('ai_home.pinned_open', { name: project.name })}
                    className="focus-visible:ring-ring/70 motion-normal flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-transparent p-3 pr-12 text-left transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div
                      className="motion-normal flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 motion-reduce:scale-100"
                      style={{
                        color: accent,
                        backgroundColor: `color-mix(in srgb, ${accent} 13%, transparent)`
                      }}
                    >
                      {icon ? (
                        <Suspense fallback={letterFallback}>{icon}</Suspense>
                      ) : (
                        letterFallback
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="text-ql-13 text-foreground truncate font-semibold">
                          {project.name}
                        </h3>
                        <Pin aria-hidden className="text-primary/70 ml-auto h-3 w-3 shrink-0" />
                      </div>
                      <p className="text-ql-11 text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5">
                        <Link2 aria-hidden className="h-3 w-3 shrink-0" />
                        <span className="truncate">{siteName}</span>
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(event) => handleRemove(event, project.id, index)}
                    aria-label={t('ai_home.pinned_remove', { name: project.name })}
                    title={t('ai_home.pinned_remove', { name: project.name })}
                    className="motion-normal text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring/70 absolute top-1/2 right-2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md transition-[color,background-color] focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <X aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
              </MagicCard>
            </BlurFade>
          </div>
        )
      })}
    </div>
  )
})

export default AiHomePinnedProjects
