import type { IconProps } from '../iconProps'

export default function AiBrandIcon({
  className = 'w-4 h-4',
  strokeWidth = 1.8,
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
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-4 3 1.5-5.3A8.5 8.5 0 1 1 21 11.5z" />
      <circle cx="12" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="13.2" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.2" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
