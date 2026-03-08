import { memo } from 'react'
import { ChevronDown } from 'lucide-react'

interface BottomScrollCueProps {
    visible: boolean;
    testId?: string;
}

export const BottomScrollCue = memo(({ visible, testId }: BottomScrollCueProps) => {
    if (!visible) return null

    return (
        <div
            aria-hidden="true"
            data-testid={testId}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-1.5"
        >
            <div className="absolute inset-x-1 bottom-0 h-10 rounded-b-2xl bg-gradient-to-t from-black/55 via-black/18 to-transparent" />
            <div className="relative flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white/70 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.9)] backdrop-blur-md">
                <ChevronDown className="h-3 w-3" strokeWidth={2.25} />
            </div>
        </div>
    )
})

BottomScrollCue.displayName = 'BottomScrollCue'
