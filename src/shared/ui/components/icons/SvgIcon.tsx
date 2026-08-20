/**
 * Shared SVG wrapper for the standard Lucide-style icon set.
 *
 * Eliminates ~7 lines of boilerplate per icon across IconsUI, IconsAI, IconsAction.
 * ~31 icons → ~200 lines saved.
 *
 * Size and stroke follow the icon contract in ./iconProps:
 * default size 16px, default stroke 2; `variant="subtle"` opts into 1.5.
 */
import type { ReactNode } from 'react'

import { ICON_VARIANT_STROKE_WIDTHS, type IconProps, resolveIconClasses } from './iconProps'

export function SvgIcon({
  size = 'default',
  variant = 'default',
  strokeWidth,
  className,
  style,
  children
}: IconProps & { children?: ReactNode }) {
  return (
    <svg
      className={resolveIconClasses(size, className)}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? ICON_VARIANT_STROKE_WIDTHS[variant]}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}
