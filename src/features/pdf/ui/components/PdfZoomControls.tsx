import { IconButton } from '@app/components/ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'

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
    <div className="bg-muted/40 flex items-center gap-1 rounded-lg p-1.5">
      <ZoomOut>
        {(props: RenderChildProps) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                variant="ghost"
                size="compact"
                onClick={props.onClick}
                className="text-muted-foreground"
                aria-label={t('zoom_out')}
              >
                <ZoomOutIcon className="size-3.5" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>{t('zoom_out')}</TooltipContent>
          </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                variant="ghost"
                size="compact"
                onClick={props.onClick}
                className="text-muted-foreground"
                aria-label={t('zoom_in')}
              >
                <ZoomInIcon className="size-3.5" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>{t('zoom_in')}</TooltipContent>
          </Tooltip>
        )}
      </ZoomIn>
    </div>
  )
}

export default memo(PdfZoomControls)
