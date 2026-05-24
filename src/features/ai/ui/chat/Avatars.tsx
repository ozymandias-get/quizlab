import { formatTime } from './utils'

export function AiAvatar() {
  return (
    <div className="relative flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/25 to-amber-600/10 ring-1 ring-amber-500/25 shadow-sm shadow-amber-500/5 select-none">
      <svg
        className="h-4 w-4 text-amber-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="8" cy="16" r="1" />
        <circle cx="16" cy="16" r="1" />
        <path d="M10 19h4" />
      </svg>
      <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-white/[0.03] to-transparent pointer-events-none" />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
    </div>
  )
}

export function UserAvatar() {
  return (
    <div className="relative flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-700/40 to-zinc-800/20 ring-1 ring-zinc-700/50 shadow-sm shadow-black/10 select-none">
      <svg
        className="h-3.5 w-3.5 text-white/50"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-white/[0.03] to-transparent pointer-events-none" />
    </div>
  )
}

export function Timestamp({ ts }: { ts: number }) {
  return (
    <span className="text-ql-10 text-white/15 group-hover:text-white/35 transition-colors select-none">
      {formatTime(ts)}
    </span>
  )
}
