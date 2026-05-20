import type { WebviewDebugState } from '../model/types'

interface WebviewStateDisplayProps {
  state: WebviewDebugState
}

function StatusIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${active ? 'bg-green-400' : 'bg-red-400'}`}
    />
  )
}

export default function WebviewStateDisplay({ state }: WebviewStateDisplayProps) {
  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="text-white/40">Webview ID:</div>
        <div className="text-white/70 font-mono text-[10px] truncate">
          {state.activeWebviewId || 'none'}
        </div>

        <div className="text-white/40">Provider:</div>
        <div className="text-white/70">{state.currentProvider || 'none'}</div>

        <div className="text-white/40">Visible:</div>
        <div className="flex items-center gap-1.5">
          <StatusIndicator active={state.visible} />
          <span className="text-white/70">{state.visible ? 'yes' : 'no'}</span>
        </div>

        <div className="text-white/40">Ready:</div>
        <div className="flex items-center gap-1.5">
          <StatusIndicator active={state.ready} />
          <span className="text-white/70">{state.ready ? 'yes' : 'no'}</span>
        </div>

        <div className="text-white/40">Frozen:</div>
        <div className="flex items-center gap-1.5">
          <StatusIndicator active={state.frozen} />
          <span className={state.frozen ? 'text-red-400' : 'text-white/70'}>
            {state.frozen ? 'yes' : 'no'}
          </span>
        </div>

        <div className="text-white/40">Automation:</div>
        <div className="flex items-center gap-1.5">
          <StatusIndicator active={!state.automationLocked} />
          <span className={state.automationLocked ? 'text-yellow-400' : 'text-white/70'}>
            {state.automationLocked ? 'locked' : 'free'}
          </span>
        </div>

        <div className="text-white/40">Queue:</div>
        <div className="flex items-center gap-1.5">
          <StatusIndicator active={!state.queueBlocked} />
          <span className={state.queueBlocked ? 'text-red-400' : 'text-white/70'}>
            {state.queueBlocked ? 'blocked' : 'open'}
          </span>
        </div>

        <div className="text-white/40">Selector:</div>
        <div className="text-white/70 font-mono text-[10px]">
          {state.activeSelectorStrategy || 'default'}
        </div>

        <div className="text-white/40">Fallback:</div>
        <div className="flex items-center gap-1.5">
          <StatusIndicator active={state.fallbackActive} />
          <span className={state.fallbackActive ? 'text-yellow-400' : 'text-white/70'}>
            {state.fallbackActive ? 'active' : 'idle'}
          </span>
        </div>

        <div className="text-white/40">Last execJS:</div>
        <div className="text-white/70 font-mono">
          {state.lastExecuteJsDuration !== null
            ? `${Math.round(state.lastExecuteJsDuration)}ms`
            : '-'}
        </div>
      </div>
    </div>
  )
}
