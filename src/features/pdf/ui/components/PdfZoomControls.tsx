import {
  IconButton,
  ToolbarGroup,
  ToolbarSeparator,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@shared/ui/components/primitives'

import { ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon } from 'lucide-react'
import { type ComponentType, memo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

interface RenderChildProps {
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
    <ToolbarGroup>
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

      <ToolbarSeparator className="@max-[430px]:hidden" />

      <div>
        <CurrentScale>
          {(props: { scale: number }) => {
            const pct = Math.round(props.scale * 100)
            const label = t('zoom_level', { value: pct }) || `${pct}%`
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Read-only readout: the viewer owns zoom, so this must not
                      look like a button that would open a level picker. */}
                  <span
                    className="text-ql-12 text-foreground @max-[430px]:text-ql-10 inline-block min-w-[38px] rounded-md px-1 py-0.5 text-center font-medium tabular-nums select-none"
                    aria-label={label}
                  >
                    {pct}%
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {label} — {t('zoom_hint', { defaultValue: 'Use + / − to adjust' })}
                </TooltipContent>
              </Tooltip>
            )
          }}
        </CurrentScale>
      </div>

      <ToolbarSeparator className="@max-[430px]:hidden" />

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
    </ToolbarGroup>
  )
}

export default memo(PdfZoomControls)
