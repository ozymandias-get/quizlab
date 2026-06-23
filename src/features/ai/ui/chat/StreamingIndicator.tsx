import { memo } from 'react'

const StreamingIndicator = memo(function StreamingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="relative rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-amber-500/[0.02] px-4 py-3 shadow-sm shadow-amber-500/5 backdrop-blur-md">
        <div className="flex gap-1.5">
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-amber-500/60"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-amber-500/60"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-amber-500/60"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
})

export default StreamingIndicator
