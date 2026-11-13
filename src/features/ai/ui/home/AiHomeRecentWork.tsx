import { BlurFade } from '@app/components/ui/blur-fade'
import { MagicCard } from '@app/components/ui/magic-card'
import { getAiIcon } from '@ui/components/Icons'

import { Clock3, FileText, X } from 'lucide-react'
import { memo, type MouseEvent as ReactMouseEvent, Suspense, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { RecentAiWorkEntry } from '../../lib/recentWork'
import type { AiSiteMap } from '../../model/home'
import { safeAiAccentColor } from '../../model/home'

interface AiHomeRecentWorkProps {
  aiSites: AiSiteMap
  entries: RecentAiWorkEntry[]
  onOpen: (modelId: string, url: string) => void
  onRemove: (id: string) => void
}

/** "az önce", "5 dk önce", "3 sa önce", "2 gün önce" or a short date. */
function formatLastUsed(
  timestamp: number,
  language: string,
  justNow: string,
  absoluteLabel: (value: number) => string
): { relative: string; absolute: string } {
  const diff = timestamp - Date.now()
  const absolute = Math.abs(diff)
  if (absolute < 60_000) return { relative: justNow, absolute: absoluteLabel(timestamp) }

  const relativeFormatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  if (absolute < 3_600_000) {
    return {
      relative: relativeFormatter.format(Math.round(diff / 60_000), 'minute'),
      absolute: absoluteLabel(timestamp)
    }
  }
  if (absolute < 86_400_000) {
    return {
      relative: relativeFormatter.format(Math.round(diff / 3_600_000), 'hour'),
      absolute: absoluteLabel(timestamp)
    }
  }
  if (absolute < 7 * 86_400_000) {
    return {
      relative: relativeFormatter.format(Math.round(diff / 86_400_000), 'day'),
      absolute: absoluteLabel(timestamp)
    }
  }

  const shortDate = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short'
  }).format(new Date(timestamp))
  return { relative: shortDate, absolute: absoluteLabel(timestamp) }
}

const AiHomeRecentWork = memo(function AiHomeRecentWork({
  aiSites,
  entries,
  onOpen,
  onRemove
}: AiHomeRecentWorkProps) {
  const { t, i18n } = useTranslation()
  const language = i18n?.language ?? 'en'
  const gridRef = useRef<HTMLDivElement>(null)

  const handleOpen = useCallback(
    (entry: RecentAiWorkEntry) => {
      onOpen(entry.modelId, entry.url)
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
      // Capture the section toggle before `onRemove` unmounts this list on the last item.
      const sectionToggle =
        gridRef.current
          ?.closest('section')
          ?.querySelector<HTMLButtonElement>('button[aria-expanded]') ?? null
      onRemove(id)
      requestAnimationFrame(() => {
        const buttons = gridRef.current?.querySelectorAll<HTMLButtonElement>('[data-recent-open]')
        if (buttons && buttons.length > 0) {
          buttons[Math.min(index, buttons.length - 1)]?.focus()
          return
        }
        if (sectionToggle?.isConnected) {
          sectionToggle.focus()
        }
      })
    },
    [onRemove]
  )

  return (
    <div ref={gridRef} className="grid gap-2.5 sm:grid-cols-2">
      {entries.map((entry, index) => {
        const site = aiSites[entry.modelId]
        const accent = safeAiAccentColor(site?.color)
        const displayName = site?.displayName || site?.name || entry.modelId
        const documentName = entry.documentName || t('ai_home.recent_no_document')
        const lastUsed = formatLastUsed(
          entry.lastUsedAt,
          language,
          t('ai_home.recent_just_now'),
          (value) =>
            new Intl.DateTimeFormat(language, {
              dateStyle: 'medium',
              timeStyle: 'short'
            }).format(new Date(value))
        )
        const icon = getAiIcon(site?.icon || entry.modelId)
        const letterFallback = (
          <span
            aria-hidden
            className="border-primary/20 from-primary/20 to-primary/5 text-primary text-ql-13 flex size-full items-center justify-center rounded-[inherit] border bg-gradient-to-br font-bold uppercase"
          >
            {displayName.charAt(0)}
          </span>
        )

        return (
          <div key={entry.id} className="group relative rounded-xl">
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
                    data-recent-open=""
                    onClick={() => handleOpen(entry)}
                    aria-label={t('ai_home.recent_open', {
                      name: displayName,
                      document: documentName
                    })}
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
                          {displayName}
                        </h3>
                        <span
                          title={lastUsed.absolute}
                          className="text-ql-10 text-muted-foreground ml-auto flex shrink-0 items-center gap-0.5"
                        >
                          <Clock3 aria-hidden className="h-3 w-3" />
                          {lastUsed.relative}
                        </span>
                      </div>
                      <p className="text-ql-11 text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5">
                        <FileText aria-hidden className="h-3 w-3 shrink-0" />
                        <span className="truncate" title={documentName}>
                          {documentName}
                        </span>
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(event) => handleRemove(event, entry.id, index)}
                    aria-label={t('ai_home.recent_remove', { document: documentName })}
                    title={t('ai_home.recent_remove', { document: documentName })}
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

export default AiHomeRecentWork
