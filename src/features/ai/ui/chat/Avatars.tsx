import { Avatar, AvatarFallback } from '@app/components/ui/avatar'

import { Bot, User } from 'lucide-react'
import { memo } from 'react'

import { formatTime } from './utils'

export const AiAvatar = memo(function AiAvatar() {
  return (
    <div className="relative shrink-0">
      <Avatar className="size-7.5 rounded-lg bg-gradient-to-br from-amber-500/25 to-amber-600/10 shadow-sm ring-1 shadow-amber-500/5 ring-amber-500/25 select-none [&>span]:rounded-lg">
        <AvatarFallback className="rounded-lg bg-transparent text-amber-400">
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
      <Avatar className="size-7.5 rounded-lg bg-gradient-to-br from-zinc-700/40 to-zinc-800/20 shadow-sm ring-1 shadow-black/10 ring-zinc-700/50 select-none [&>span]:rounded-lg">
        <AvatarFallback className="rounded-lg bg-transparent text-white/50">
          <User className="size-3.5" />
        </AvatarFallback>
      </Avatar>
    </div>
  )
})

export const Timestamp = memo(function Timestamp({ ts }: { ts: number }) {
  return (
    <span className="text-ql-10 text-white/15 transition-colors select-none group-hover:text-white/35">
      {formatTime(ts)}
    </span>
  )
})
