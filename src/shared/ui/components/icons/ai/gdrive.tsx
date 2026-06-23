import type { IconProps } from '../iconProps'

export default function AiBrandIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M9.2 3.5H14.8L21 14.25H15.4L9.2 3.5Z" fill="#0F9D58" />
      <path d="M8.6 4.1L11.4 8.95L6.15 18H3L8.6 4.1Z" fill="#F4B400" />
      <path d="M6.75 18.5L9.55 13.65H21L18.2 18.5H6.75Z" fill="#4285F4" />
    </svg>
  )
}
