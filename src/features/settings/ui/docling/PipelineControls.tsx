import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

export interface PipelineRowProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  disabledReason?: string | null
  warning?: boolean
}

export function PipelineRow({
  icon: Icon,
  title,
  desc,
  checked,
  onChange,
  disabled = false,
  disabledReason,
  warning = false
}: PipelineRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex gap-2.5">
        <div className="bg-muted text-muted-foreground mt-0.5 rounded-md p-1.5">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p
            className={`text-ql-13 leading-4 font-medium ${warning ? 'text-amber-600 dark:text-amber-400' : ''}`}
          >
            {title}
          </p>
          <p className="text-ql-11 text-muted-foreground leading-4">{desc}</p>
          {disabledReason && (
            <p className="text-ql-11 text-amber-600 dark:text-amber-400">{disabledReason}</p>
          )}
        </div>
      </div>
      <SettingsToggleSwitch
        checked={checked}
        onChange={onChange}
        disabled={disabled || !!disabledReason}
      />
    </div>
  )
}

export function PipelineNumberField({
  label,
  value,
  min,
  max,
  onChange,
  disabled
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <label className="text-ql-12 flex flex-col gap-1">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value)
          if (!Number.isNaN(n)) onChange(n)
        }}
        disabled={disabled}
        className="border-border bg-card text-ql-12 rounded-md border px-2 py-1"
      />
    </label>
  )
}
