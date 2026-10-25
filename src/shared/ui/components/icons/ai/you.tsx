import type { IconProps } from '../iconProps'
import iconUrl from './assets/you.ico'

export default function AiBrandIcon({ className = 'w-5 h-5', style }: IconProps) {
  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={style}
    />
  )
}
