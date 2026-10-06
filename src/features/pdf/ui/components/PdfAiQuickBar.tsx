import { Button } from '@app/components/ui/button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { ToolbarGroup, ToolbarSeparator } from '@shared/ui/components/primitives'

import { Crop, Image as ImageIcon, RefreshCw, Type } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface PdfAiQuickBarProps {
  onAddCurrentPageTextToAi?: () => void
  onSendPageAsImageToAi?: () => void
  onAreaScreenshot?: () => void
  onReload?: () => void
  /**
   * The three actions that read the page text layer or the legacy viewer's
   * document registry are unavailable (the native canvas viewer renders neither
   * yet). They are disabled rather than hidden, with a tooltip that says why, so
   * the group keeps its layout and no button silently does nothing.
   *
   * Reload is untouched: it drives a document lifecycle, which the native viewer
   * does own.
   */
  textLayerActionsDisabled?: boolean
}

function PdfAiQuickBar({
  onAddCurrentPageTextToAi,
  onSendPageAsImageToAi,
  onAreaScreenshot,
  onReload,
  textLayerActionsDisabled = false
}: PdfAiQuickBarProps) {
  const { t } = useTranslation()

  const unavailableLabel = t('pdf_text_layer_unavailable', {
    defaultValue: 'Needs the page text layer — not available in the native canvas preview'
  })

  /** Tooltip text: the action's own label, plus why it is unavailable. */
  const labelFor = (label: string) => (textLayerActionsDisabled ? unavailableLabel : label)

  const unavailableClass =
    'text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground/50'

  return (
    <div
      className="flex max-w-full min-w-0 items-center justify-center overflow-hidden"
      data-testid="pdf-ai-quick-bar"
      role="toolbar"
      aria-label={t('pdf_ai_quick_actions', { defaultValue: 'AI İşlemleri' })}
    >
      {/* Tek hap grup: viewer modundaki PageNav/Zoom gruplarıyla aynı dil.
          Görünür etiketler kısa tutulur, tam adlar tooltip + aria-label'dadır;
          taşmaya karşı truncate + max-w güvencesi vardır. */}
      <ToolbarGroup className="max-w-full min-w-0 gap-0.5 overflow-hidden p-1">
        <WithTooltip label={labelFor(t('pdf_add_current_page_text_to_ai'))}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddCurrentPageTextToAi}
            disabled={textLayerActionsDisabled}
            aria-label={t('pdf_add_current_page_text_to_ai')}
            className={`text-muted-foreground hover:text-foreground min-w-0 shrink-0 gap-1.5${
              textLayerActionsDisabled ? ` ${unavailableClass}` : ''
            }`}
            data-testid="pdf-quick-text-ai"
          >
            <Type className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="text-ql-12 hidden max-w-[110px] truncate font-medium sm:inline xl:max-w-none">
              {t('pdf_quick_text_ai')}
            </span>
          </Button>
        </WithTooltip>

        <WithTooltip label={labelFor(t('pdf_send_page_as_image'))}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSendPageAsImageToAi}
            disabled={textLayerActionsDisabled}
            aria-label={t('pdf_send_page_as_image')}
            className={`text-muted-foreground hover:text-foreground min-w-0 shrink-0 gap-1.5${
              textLayerActionsDisabled ? ` ${unavailableClass}` : ''
            }`}
            data-testid="pdf-quick-image-ai"
          >
            <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="text-ql-12 hidden max-w-[110px] truncate font-medium sm:inline xl:max-w-none">
              {t('pdf_quick_image_ai')}
            </span>
          </Button>
        </WithTooltip>

        <WithTooltip label={labelFor(t('ctx_crop_screenshot_ai'))}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAreaScreenshot}
            disabled={textLayerActionsDisabled}
            aria-label={t('ctx_crop_screenshot_ai')}
            className={`text-muted-foreground hover:text-foreground min-w-0 shrink-0 gap-1.5${
              textLayerActionsDisabled ? ` ${unavailableClass}` : ''
            }`}
            data-testid="pdf-quick-area-ai"
          >
            <Crop className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="text-ql-12 hidden max-w-[110px] truncate font-medium sm:inline xl:max-w-none">
              {t('pdf_quick_area_ai')}
            </span>
          </Button>
        </WithTooltip>

        <ToolbarSeparator />

        <WithTooltip label={`${t('ctx_reload')} (Ctrl+R)`}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReload}
            aria-label={t('ctx_reload')}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive min-w-0 shrink-0 gap-1.5"
            data-testid="pdf-quick-reload"
          >
            <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="text-ql-12 hidden max-w-[110px] truncate font-medium sm:inline xl:max-w-none">
              {t('ctx_reload')}
            </span>
          </Button>
        </WithTooltip>
      </ToolbarGroup>
    </div>
  )
}

export default memo(PdfAiQuickBar)
