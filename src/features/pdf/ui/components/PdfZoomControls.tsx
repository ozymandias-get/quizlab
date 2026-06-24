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
    <div className="glass-tier-3 glass-tier-toolbar flex items-center gap-1 p-1.5">
      <ZoomOut>
        {(props: RenderChildProps) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={props.onClick}
            className="h-8 w-8 rounded-xl text-white/50 transition-[background-color,color,border-color,box-shadow] duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500 [&_svg]:transition-none"
            title={t('zoom_out')}
            aria-label={t('zoom_out')}
          >
            <ZoomOutIcon className="h-4 w-4" />
          </Button>
        )}
      </ZoomOut>

      <div className="h-5 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <CurrentScale>
        {(props: { scale: number }) => (
          <div className="min-w-[56px] rounded-md border border-white/[0.06] bg-white/[0.06] px-2 py-1 text-center">
            <span className="text-ql-12 font-medium text-white/70 tabular-nums select-none">
              {Math.round(props.scale * 100)}%
            </span>
          </div>
        )}
      </CurrentScale>

      <div className="h-5 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <ZoomIn>
        {(props: RenderChildProps) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={props.onClick}
            className="h-8 w-8 rounded-xl text-white/50 transition-[background-color,color,border-color,box-shadow] duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500 [&_svg]:transition-none"
            title={t('zoom_in')}
            aria-label={t('zoom_in')}
          >
            <ZoomInIcon className="h-4 w-4" />
          </Button>
        )}
      </ZoomIn>
    </div>
  )
}

export default memo(PdfZoomControls)
