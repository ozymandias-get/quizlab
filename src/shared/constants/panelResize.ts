/** Set on `document.body` synchronously while hub/panel drag runs (before React state updates). */
export const PANEL_RESIZING_BODY_CLASS = 'panel-resizing'

/**
 * Geçici: `zoomTo(PageWidth)` sonrası sayfa katmanı yeniden çizilirken gösterilen
 * `.rpv-core__spinner` (DocumentLoader/renderLoader değil — bkz. @react-pdf-viewer core PageLayer) gizlenir.
 */
export const PDF_REFIT_SPINNER_SUPPRESS_BODY_CLASS = 'pdf-refit-spinners-suppressed'
