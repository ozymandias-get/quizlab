// Motion durations (seconds) used by JS-driven animation. The full CSS
// transition scale lives in src/shared/styles/index.css (--duration-*); add a
// value here only when a JS animation actually needs one.
export const DURATION = {
  fast: 0.08,
  normal: 0.14,
  slow: 0.2,
  slower: 0.28,
  deliberate: 0.4
} as const
