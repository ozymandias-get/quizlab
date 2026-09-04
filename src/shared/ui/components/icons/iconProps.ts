import type { CSSProperties } from 'react'

/**
 * Icon contract — library-independent tokens for every icon in the app.
 *
 * Sizes:
 * - xs      → 12px
 * - sm      → 14px
 * - default → 16px
 * - lg      → 20px
 *
 * Stroke:
 * - default → 2 (standard UI icons)
 * - subtle  → 1.5 (decorative/detail icons only, conscious use)
 *
 * Anything outside these tokens (e.g. a 24px banner icon or a brand mark)
 * must be passed explicitly via `className` / `strokeWidth` and is an
 * intentional exception, not the default.
 */
export type IconSize = 'xs' | 'sm' | 'default' | 'lg'

export type IconVariant = 'default' | 'subtle'

const ICON_SIZE_CLASSES: Record<IconSize, string> = {
  xs: 'size-3',
  sm: 'size-3.5',
  default: 'size-4',
  lg: 'size-5'
}

const ICON_DEFAULT_STROKE_WIDTH = 2
const ICON_SUBTLE_STROKE_WIDTH = 1.5

export const ICON_VARIANT_STROKE_WIDTHS: Record<IconVariant, number> = {
  default: ICON_DEFAULT_STROKE_WIDTH,
  subtle: ICON_SUBTLE_STROKE_WIDTH
}

const HAS_SIZE_CLASS = /(?:^|\s)(?:h|w|size)-/

/**
 * Merges the contract size class with a consumer-supplied className.
 * A consumer className that already sets h-/w- utilities wins over the
 * contract size, so explicit overrides stay deterministic.
 */
export function resolveIconClasses(size: IconSize, className?: string): string {
  const sizeClass = ICON_SIZE_CLASSES[size]
  if (!className) return sizeClass
  return HAS_SIZE_CLASS.test(className) ? className : `${sizeClass} ${className}`
}

export interface IconProps {
  className?: string
  /** Semantic size token; overridden by a className that sets h-/w- utilities. */
  size?: IconSize
  /** Semantic stroke token; `subtle` is reserved for decorative icons. */
  variant?: IconVariant
  /** Raw override — explicit value always wins over the variant token. */
  strokeWidth?: number | string
  style?: CSSProperties
}
