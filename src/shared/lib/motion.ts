// Motion duration scale (seconds) — mirrors the CSS duration tokens in
// src/shared/styles/index.css (--duration-*). Use these instead of literals
// so JS motion timing stays in sync with the CSS transition scale.
export const DURATION = {
  instant: 0,
  fast: 0.08,
  normal: 0.14,
  slow: 0.2,
  slower: 0.28,
  deliberate: 0.4,
  slowest: 0.6
} as const
