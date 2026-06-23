import type { IconProps } from '../iconProps'

export default function AiBrandIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2.15" y="4.15" width="19.7" height="15.7" rx="5.45" fill="#FF0033" />
      <path d="M10.15 8.95V15.05L15.6 12L10.15 8.95Z" fill="white" />
    </svg>
  )
}
