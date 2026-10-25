import type { IconProps } from '../iconProps'

/** Source: Lobe Icons 1.100.0 (MIT); see assets/README.md */
export default function AiBrandIcon({ className = 'w-5 h-5', style }: IconProps) {
  return (
    <svg
      fill="currentColor"
      fillRule="evenodd"
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <title>Pi</title>
      <path clipRule="evenodd" d="M1 1h16.5v11H12v5.5H6.5V23H1V1zm5.5 5.5V12H12V6.5H6.5z" />
      <path d="M17.5 12H23v11h-5.5V12z" />
    </svg>
  )
}
