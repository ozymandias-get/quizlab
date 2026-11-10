import { PDF_ZOOM_MAX_SCALE, PDF_ZOOM_MIN_SCALE } from '@features/pdf/constants/pdfZoom'

import { cn } from '@shared/lib/uiUtils'
import {
  IconButton,
  ToolbarGroup,
  ToolbarSeparator,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@shared/ui/components/primitives'

import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon } from 'lucide-react'
import { type ComponentType, Fragment, memo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

interface RenderChildProps {
  onClick: () => void
  scale?: number
}

export interface ZoomPresetActions {
  zoomTo?: (scale: number) => void
  fitWidth?: () => void
  fitPage?: () => void
}

export type ZoomComponent = ComponentType<{
  children: (props: RenderChildProps) => ReactElement
}>

export type CurrentScaleComponent = ComponentType<{
  children: (props: { scale: number } & ZoomPresetActions) => ReactElement
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
        {(props: RenderChildProps) => {
          const atMin = typeof props.scale === 'number' && props.scale <= PDF_ZOOM_MIN_SCALE + 1e-6
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  variant="ghost"
                  size="compact"
                  onClick={atMin ? undefined : props.onClick}
                  aria-disabled={atMin || undefined}
                  className={cn(
                    'text-muted-foreground',
                    atMin && 'cursor-not-allowed opacity-30 hover:bg-transparent'
                  )}
                  aria-label={atMin ? t('zoom_min_reached') : t('zoom_out')}
                >
                  <ZoomOutIcon className="size-3.5" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent>{atMin ? t('zoom_min_reached') : t('zoom_out')}</TooltipContent>
            </Tooltip>
          )
        }}
      </ZoomOut>

      <ToolbarSeparator className="@max-[430px]:hidden" />

      <div>
        <CurrentScale>
          {(props) => {
            const pct = Math.round(props.scale * 100)
            const label = t('zoom_level', { value: pct }) || `${pct}%`
            const presets = [50, 100, 150]
            return (
              <Popover className="relative">
                <PopoverButton
                  className="text-ql-12 text-foreground hover:bg-muted @max-[430px]:text-ql-10 inline-flex min-w-[38px] items-center justify-center gap-1 rounded-md px-1 py-0.5 text-center font-medium tabular-nums transition-colors outline-none select-none"
                  aria-label={t('zoom_presets')}
                  title={label}
                >
                  {pct}%
                </PopoverButton>
                <Transition
                  as={Fragment}
                  enter="transition ease-out motion-normal"
                  enterFrom="opacity-0 translate-y-1 scale-98"
                  enterTo="opacity-100 translate-y-0 scale-100"
                  leave="transition ease-in motion-fast"
                  leaveFrom="opacity-100 translate-y-0 scale-100"
                  leaveTo="opacity-0 translate-y-1 scale-98"
                >
                  <PopoverPanel className="border-border bg-popover text-popover-foreground shadow-ambient-lg z-dropdown absolute top-full left-1/2 mt-2 w-44 -translate-x-1/2 rounded-xl border p-1">
                    {presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => props.zoomTo?.(preset / 100)}
                        disabled={!props.zoomTo}
                        className={cn(
                          'text-ql-12 text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors',
                          pct === preset && 'text-primary bg-primary/10 font-semibold'
                        )}
                      >
                        <span>{preset}%</span>
                      </button>
                    ))}
                    <div aria-hidden className="bg-border/40 mx-1.5 my-1 h-px" />
                    <button
                      type="button"
                      onClick={() => props.fitWidth?.()}
                      disabled={!props.fitWidth}
                      className="text-ql-12 text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center rounded-md px-2.5 py-1.5 text-left transition-colors"
                    >
                      {t('fit_width')}
                    </button>
                    <button
                      type="button"
                      onClick={() => props.fitPage?.()}
                      disabled={!props.fitPage}
                      className="text-ql-12 text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center rounded-md px-2.5 py-1.5 text-left transition-colors"
                    >
                      {t('fit_page')}
                    </button>
                  </PopoverPanel>
                </Transition>
              </Popover>
            )
          }}
        </CurrentScale>
      </div>

      <ToolbarSeparator className="@max-[430px]:hidden" />

      <ZoomIn>
        {(props: RenderChildProps) => {
          const atMax = typeof props.scale === 'number' && props.scale >= PDF_ZOOM_MAX_SCALE - 1e-6
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  variant="ghost"
                  size="compact"
                  onClick={atMax ? undefined : props.onClick}
                  aria-disabled={atMax || undefined}
                  className={cn(
                    'text-muted-foreground',
                    atMax && 'cursor-not-allowed opacity-30 hover:bg-transparent'
                  )}
                  aria-label={atMax ? t('zoom_max_reached') : t('zoom_in')}
                >
                  <ZoomInIcon className="size-3.5" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent>{atMax ? t('zoom_max_reached') : t('zoom_in')}</TooltipContent>
            </Tooltip>
          )
        }}
      </ZoomIn>
    </ToolbarGroup>
  )
}

export default memo(PdfZoomControls)
