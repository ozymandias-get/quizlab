import type { IconProps } from '../iconProps'

export default function AiBrandIcon({
  className = 'w-4 h-4',
  strokeWidth = 1.5,
  style
}: IconProps) {
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
      <path d="M15 6V21M15 6L21 3V18L15 21M15 6L9 3M15 21L9 18M9 18L3 21V6L9 3M9 18V3" />
    </svg>
  )
}
