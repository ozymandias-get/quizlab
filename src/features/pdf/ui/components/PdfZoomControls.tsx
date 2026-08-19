import { Button } from '@app/components/ui/button'

import { ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon } from 'lucide-react'
import { type ComponentType, memo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

export interface RenderChildProps {
  onClick: () => void
  scale?: number
}

export type ZoomComponent = ComponentType<{
  children: (props: RenderChildProps) => ReactElement
}>

export type CurrentScaleComponent = ComponentType<{
  children: (props: { scale: number }) => ReactElement
}>

interface PdfZoomControlsProps {
  ZoomIn: ZoomComponent
  ZoomOut: ZoomComponent
  CurrentScale: CurrentScaleComponent
}

function PdfZoomControls({ ZoomIn, ZoomOut, CurrentScale }: PdfZoomControlsProps) {
  const { t } = useTranslation()

  return (
    <div className="glass-tier-3 glass-tier-toolbar border-border/70 bg-card/60 flex items-center gap-1 rounded-lg border p-1.5 shadow-xs">
      <ZoomOut>
        {(props: RenderChildProps) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={props.onClick}
            className="text-muted-foreground hover:bg-muted hover:text-foreground h-7 w-7 rounded-md transition-colors"
            title={t('zoom_out')}
            aria-label={t('zoom_out')}
          >
            <ZoomOutIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </ZoomOut>

      <div className="bg-border/80 h-4 w-px" />

      <CurrentScale>
        {(props: { scale: number }) => (
          <div className="min-w-[50px] px-1.5 py-0.5 text-center">
            <span className="text-ql-12 text-foreground font-medium tabular-nums select-none">
              {Math.round(props.scale * 100)}%
            </span>
          </div>
        )}
      </CurrentScale>

      <div className="bg-border/80 h-4 w-px" />

      <ZoomIn>
        {(props: RenderChildProps) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={props.onClick}
            className="text-muted-foreground hover:bg-muted hover:text-foreground h-7 w-7 rounded-md transition-colors"
            title={t('zoom_in')}
            aria-label={t('zoom_in')}
          >
            <ZoomInIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </ZoomIn>
    </div>
  )
}

export default memo(PdfZoomControls)
