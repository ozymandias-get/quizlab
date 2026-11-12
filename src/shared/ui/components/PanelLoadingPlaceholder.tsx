import { memo } from 'react'

/**
 * Neutral stand-in while the AI panel mounts.
 *
 * Deliberately holds no icon or copy: the panel's own loading surface (the
 * opening site's brand mark) belongs to `AiSiteLoader`, and showing a second,
 * different mark here made that first frame look like the wrong site.
 */
const PanelLoadingPlaceholder = memo(function PanelLoadingPlaceholder() {
  return (
    <div
      aria-hidden
      data-testid="panel-loading-placeholder"
      className="bg-background h-full w-full"
    />
  )
})

export default PanelLoadingPlaceholder
