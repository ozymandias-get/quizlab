import { memo } from 'react'

const StreamingIndicator = memo(function StreamingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="relative rounded-xl border border-white/[0.07] bg-zinc-950/85 px-4 py-3 shadow-2xl">
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400/70"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400/70"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400/70"
            style={{ animationDelay: '300ms' }}
          />
          <span
            className="ml-2 h-2 w-24 rounded-full bg-white/5 motion-safe:animate-pulse"
            aria-hidden
          />
          <span
            className="h-2 w-12 rounded-full bg-white/5 motion-safe:animate-pulse"
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
})

export default StreamingIndicator
