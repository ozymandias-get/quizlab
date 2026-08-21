import { IconButton } from '@app/components/ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
import { ToolbarGroup, ToolbarSeparator } from '@shared/ui/components/primitives'

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

      <ToolbarSeparator />

      <CurrentScale>
        {(props: { scale: number }) => {
          const pct = Math.round(props.scale * 100)
          const label = t('zoom_level', { value: pct }) || `${pct}%`
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="hover:bg-muted focus-visible:ring-ring/40 min-w-[50px] rounded-md px-1.5 py-0.5 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={label}
                  onClick={() => {
                    // Zoom controls are viewer-owned; this button surfaces the level for a11y
                    // and keeps the toolbar keyboard-navigable (no-op).
                  }}
                >
                  <span className="text-ql-12 text-foreground font-medium tabular-nums select-none">
                    {pct}%
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {label} — {t('zoom_hint', { defaultValue: 'Use + / − to adjust' })}
              </TooltipContent>
            </Tooltip>
          )
        }}
      </CurrentScale>

      <ToolbarSeparator />

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
