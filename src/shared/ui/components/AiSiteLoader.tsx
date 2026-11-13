import { getAiIcon } from '@ui/components/Icons'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface AiSiteLoaderProps {
  /** Model id used to resolve the site's icon. */
  modelId: string
  /** Registry override (custom sites can point at another icon). */
  iconKey?: string
}

/**
 * Waiting surface for an AI site.
 *
 * The site's own brand mark is the whole content: it names what is about to
 * appear, and a card full of invented "calibrating" messages competed with the
 * interface it was hiding. The placeholder disappears as soon as the guest
 * paints its first frame.
 */
const AiSiteLoader = memo(function AiSiteLoader({ modelId, iconKey }: AiSiteLoaderProps) {
  const { t } = useTranslation()
  const icon = getAiIcon(iconKey || modelId)
  const initial = (iconKey || modelId).charAt(0).toUpperCase()

  return (
    <div
      role="status"
      aria-label={t('loading')}
      data-testid="ai-site-loader"
      className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/95 backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-2xl border border-white/[0.07] bg-zinc-950/90 shadow-2xl ring-1 ring-white/10 motion-safe:animate-pulse [&_svg]:size-9"
      >
        {icon ?? <span className="text-ql-18 text-foreground font-bold uppercase">{initial}</span>}
      </span>
    </div>
  )
})

export default AiSiteLoader
