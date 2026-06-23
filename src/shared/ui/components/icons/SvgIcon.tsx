/**
 * Shared SVG wrapper for the standard Lucide-style icon set.
 *
 * Eliminates ~7 lines of boilerplate per icon across IconsUI, IconsAI, IconsAction.
 * ~31 icons → ~200 lines saved.
 */
import type { ReactNode } from 'react'

import type { IconProps } from './iconProps'

export function SvgIcon({
  className = 'w-5 h-5',
  strokeWidth = 2,
  style,
  children
}: IconProps & { children?: ReactNode }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}
