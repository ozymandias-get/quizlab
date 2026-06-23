export const VISION_MODEL_PATTERNS = [
  /gpt-4o/i,
  // Matches gpt-4-turbo, gpt-4-1106-turbo, gpt-4-0125-turbo, gpt-4.1-turbo, etc.
  /gpt-4(?:[.-]\d+)*-turbo/i,
  /claude-3-5/i,
  /claude-3-opus/i,
  /gemini-1\.5-pro/i,
  /gemini-2/i,
  /gemini-1\.5-flash/i
]

export function isVisionCapable(modelId: string): boolean {
  return VISION_MODEL_PATTERNS.some((re) => re.test(modelId))
}
