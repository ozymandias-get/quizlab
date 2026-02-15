import React, { useMemo } from 'react'

interface SliderProps {
    min: number
    max: number
    value: number
    step?: number
    onChange: (value: number) => void
    label?: string
    displayValue?: string | number
    className?: string
}

const Slider: React.FC<SliderProps> = ({
    min,
    max,
    step = 0.01,
    value,
    onChange,
    label,
    displayValue,
    className = ''
}) => {
    const percent = useMemo(() => {
        return ((value - min) / (max - min)) * 100
    }, [value, min, max])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(parseFloat(e.target.value))
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {(label || displayValue) && (
                <div className="flex items-center justify-between">
                    {label && <span className="text-xs font-bold text-white/60">{label}</span>}
                    {displayValue && (
                        <span className="text-[10px] font-mono font-bold text-white bg-white/[0.08] px-2 py-0.5 rounded-md">
                            {displayValue}
                        </span>
                    )}
                </div>
            )}
            <div className="relative h-6 flex items-center group">
                {/* Track background */}
                <div className="absolute inset-0 h-1.5 my-auto w-full bg-white/[0.04] rounded-full overflow-hidden">
                    {/* Active Track */}
                    <div
                        className="h-full bg-gradient-to-r from-pink-500/50 to-pink-400 transition-all duration-150"
                        style={{ width: `${percent}%` }}
                    />
                </div>

                {/* Range Input (Invisible but interactive) */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Thumb */}
                <div
                    className="absolute w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-transform duration-150 group-hover:scale-110"
                    style={{ left: `${percent}%`, transform: `translateX(-50%)` }}
                />
            </div>
        </div>
    )
}

export default React.memo(Slider)
