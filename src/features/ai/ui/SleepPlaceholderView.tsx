interface SleepPlaceholderViewProps {
  onWakeUp: () => void
  t: (key: string) => string
}

export function SleepPlaceholderView({ onWakeUp, t }: SleepPlaceholderViewProps) {
  return (
    <div
      onClick={onWakeUp}
      className="flex-1 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer select-none"
    >
      <div className="p-4 rounded-2xl bg-zinc-800/80 mb-4 border border-zinc-700/50 shadow-xl transition-transform hover:scale-105 active:scale-95">
        <svg
          className="w-8 h-8 text-zinc-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </div>
      <p className="text-zinc-200 font-medium text-ql-20">{t('ai_session.sleep_title')}</p>
      <p className="text-ql-14 text-zinc-500 mt-1 max-w-sm text-center">
        {t('ai_session.sleep_description')}
      </p>
    </div>
  )
}
