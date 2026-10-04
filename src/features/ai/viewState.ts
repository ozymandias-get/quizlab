/**
 * Tab-liveness state for the AI panel.
 *
 * Lives outside the panel component on purpose: the workspace and the focus
 * overlay each mount their own panel surface, and this state has to outlive
 * either of them so a focus-mode switch repositions the managed views instead of
 * rebuilding them.
 */
export type { AiViewSurfaceState } from './hooks/useAiViewSurfaceState'
export { useAiViewSurfaceState } from './hooks/useAiViewSurfaceState'
