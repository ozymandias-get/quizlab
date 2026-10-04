/**
 * 📐 AI View Surface — Heavy entry point (lazy-loadable)
 *
 * This barrel contains the AI panel chrome that positions the main-process owned
 * `WebContentsView`s. Consumers should lazy-load this module to keep it out of
 * the main chunk.
 */
export { default as AiViewSurface } from './ui/AiViewSurface'
