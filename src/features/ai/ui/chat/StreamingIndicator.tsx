import { memo } from 'react'

const StreamingIndicator = memo(function StreamingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="border-primary/20 from-primary/[0.06] to-primary/[0.02] shadow-primary/5 relative rounded-xl border bg-gradient-to-br px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="flex gap-1.5">
          <span
            className="bg-primary/60 h-2 w-2 animate-bounce rounded-full"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="bg-primary/60 h-2 w-2 animate-bounce rounded-full"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="bg-primary/60 h-2 w-2 animate-bounce rounded-full"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
})

export default StreamingIndicator
