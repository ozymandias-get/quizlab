/**
 * Semantic wrapper + registry for Lucide icons.
 *
 * New features must route Lucide icons through this module instead of
 * importing `lucide-react` directly, so size/stroke always follow the
 * icon contract (./iconProps):
 * - size tokens: xs 12 / sm 14 / default 16 / lg 20
 * - stroke: default 2, subtle 1.5 (decorative only)
 *
 * Brand marks and intentionally oversized exceptions may still use a raw
 * `className` / `strokeWidth` override.
 */
import type { LucideIcon as LucideIconComponent, LucideProps } from 'lucide-react'
import { Grid3x3 } from 'lucide-react'

import {
  ICON_VARIANT_STROKE_WIDTHS,
  type IconProps,
  type IconSize,
  type IconVariant,
  resolveIconClasses
} from './iconProps'

export interface SemanticIconProps extends Omit<LucideProps, 'size' | 'strokeWidth' | 'className'> {
  icon: LucideIconComponent
  /** Semantic size token; overridden by a className that sets h-/w- utilities. */
  size?: IconSize
  /** Semantic stroke token; `subtle` is reserved for decorative icons. */
  variant?: IconVariant
  /** Raw override — explicit value always wins over the variant token. */
  strokeWidth?: IconProps['strokeWidth']
  className?: string
}

export function SemanticIcon({
  icon: IconComponent,
  size = 'default',
  variant = 'default',
  strokeWidth,
  className,
  ...rest
}: SemanticIconProps) {
  return (
    <IconComponent
      className={resolveIconClasses(size, className)}
      strokeWidth={strokeWidth ?? ICON_VARIANT_STROKE_WIDTHS[variant]}
      {...rest}
    />
  )
}

/** Registry of Lucide icons by semantic name — extend here, not via raw imports. */
export const lucideIcons = {
  grid3x3: Grid3x3
} as const

export type LucideIconName = keyof typeof lucideIcons

export const Grid3x3Icon = (props: Omit<SemanticIconProps, 'icon'>) => (
  <SemanticIcon icon={lucideIcons.grid3x3} {...props} />
)
