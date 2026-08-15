import { Avatar, AvatarFallback } from '@app/components/ui/avatar'

import { Bot, User } from 'lucide-react'
import { memo } from 'react'

import { formatTime } from './chatUtils'

export const AiAvatar = memo(function AiAvatar() {
  return (
    <div className="relative shrink-0">
      <Avatar className="border-primary/20 bg-primary/10 size-7.5 rounded-lg border select-none [&>span]:rounded-lg">
        <AvatarFallback className="text-primary rounded-lg bg-transparent">
          <Bot className="size-4" />
        </AvatarFallback>
      </Avatar>
      <span className="absolute -right-0.5 -bottom-0.5 flex h-2 w-2">
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
    </div>
  )
})

export const UserAvatar = memo(function UserAvatar() {
  return (
    <div className="relative shrink-0">
      <Avatar className="border-border bg-muted size-7.5 rounded-lg border select-none [&>span]:rounded-lg">
        <AvatarFallback className="text-muted-foreground rounded-lg bg-transparent">
          <User className="size-3.5" />
        </AvatarFallback>
      </Avatar>
    </div>
  )
})

export const Timestamp = memo(function Timestamp({ ts }: { ts: number }) {
  return (
    <span className="text-ql-10 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors select-none">
      {formatTime(ts)}
    </span>
  )
})

export default AiAvatar
