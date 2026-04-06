/** Matches @react-pdf-viewer/zoom toolbar step (fraction of 1; e.g. 0.1 = 10%). */
export const PDF_ZOOM_STEP = 0.1

export const PDF_ZOOM_MIN_SCALE = 0.1

/** Debounce before refitting to PageWidth after hub/panel resize (ms). ~40–60 band for smoother live refit. */
export const PDF_RESIZE_REFIT_DEBOUNCE_MS = 50

/** Throttling interval for refitting to PageWidth during hub/panel drag (ms). */
export const PDF_HUB_DRAG_REFIT_INTERVAL_MS = 180

/** PageLayer Spinner suppression time after zoom/refit (ms). */
export const PDF_REFIT_SPINNER_SUPPRESS_MS = 800

/* Zoom level persistence: not implemented — resize refit always returns to PageWidth per product rules. */
