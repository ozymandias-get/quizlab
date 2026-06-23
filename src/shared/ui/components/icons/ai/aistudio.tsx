import type { IconProps } from '../iconProps'

export default function AiBrandIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.2" fill="#121212" />
      <path
        d="M15.2 5.95L15.88 7.67L17.6 8.35L15.88 9.03L15.2 10.75L14.52 9.03L12.8 8.35L14.52 7.67L15.2 5.95Z"
        fill="white"
      />
      <path
        d="M7.95 7.4C6.9835 7.4 6.2 8.1835 6.2 9.15V15.1C6.2 16.0665 6.9835 16.85 7.95 16.85H14.15C15.1165 16.85 15.9 16.0665 15.9 15.1V12.85"
        stroke="white"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11.2 7.4H8.7" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
