/**
 * Re-export of the canonical selector engine for Renderer usage.
 * The source of truth lives in `shared/lib/selectorEngine.ts` (@shared-core)
 * so both Electron main and Renderer share the same normalization, :has()/
 * aria-label handling and confidence scoring.
 */
export * from '@shared-core/lib/selectorEngine'
