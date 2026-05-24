export const VISION_MODEL_PATTERNS = [
  /gpt-4o/i,
  /gpt-4\.\d+-turbo/i,
  /claude-3-5/i,
  /claude-3-opus/i,
  /gemini-1\.5-pro/i,
  /gemini-2/i,
  /gemini-1\.5-flash/i
]

export function isVisionCapable(modelId: string): boolean {
  return VISION_MODEL_PATTERNS.some((re) => re.test(modelId))
}

export const AMBER_ACCENT = {
  border: 'border-amber-500/30',
  borderHover: 'hover:border-amber-500/40',
  bg: 'bg-amber-500/[0.06]',
  bgHover: 'hover:bg-amber-500/[0.08]',
  text: 'text-amber-400',
  textMuted: 'text-amber-400/60'
} as const
