import type { ProviderHealthState } from '../model/types'
import { getHealthStatusLabel, getHealthStatusColor } from '../lib/providerHealth'

interface ProviderHealthBadgeProps {
  provider: string
  health: ProviderHealthState
}

export default function ProviderHealthBadge({ provider, health }: ProviderHealthBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            health.status === 'HEALTHY'
              ? 'bg-green-400'
              : health.status === 'DEGRADED'
                ? 'bg-yellow-400'
                : health.status === 'SLOW'
                  ? 'bg-orange-400'
                  : 'bg-red-400'
          }`}
        />
        <span className="text-white/70 text-xs font-medium">{provider}</span>
      </div>
      <span className={`text-xs font-semibold ${getHealthStatusColor(health.status)}`}>
        {getHealthStatusLabel(health.status)}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              health.score >= 80
                ? 'bg-green-400'
                : health.score >= 60
                  ? 'bg-yellow-400'
                  : 'bg-red-400'
            }`}
            style={{ width: `${health.score}%` }}
          />
        </div>
        <span className="text-white/40 text-[10px] w-6 text-right">{health.score}</span>
      </div>
      {health.degradedReason && (
        <span
          className="text-white/30 text-[10px] truncate max-w-[120px]"
          title={health.degradedReason}
        >
          {health.degradedReason}
        </span>
      )}
    </div>
  )
}
