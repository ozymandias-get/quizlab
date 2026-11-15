/**
 * The picker's flash shadow, compared by meaning rather than by CSSOM notation.
 *
 * The picker writes `box-shadow: <color> 0 0 <blur>px`. Reading it back goes through
 * the environment's CSSOM, and the two jsdom generations supported by this suite
 * serialize the same declaration differently:
 *
 *   jsdom 30 → `#ef4444 0 0 25px`      (the authored hex, unitless zero offsets)
 *   jsdom 31 → `rgb(239, 68, 68) 0px 0px 25px` (normalized color, `0px` offsets)
 *
 * Assertions here are about *which* shadow was applied, so the value is normalized to
 * the older notation first: colors to lowercase hex, zero lengths to unitless zero.
 * Non-zero lengths keep their unit in both serializations.
 */
export function normalizeBoxShadow(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(
      /\brgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
      (_match, red: string, green: string, blue: string) =>
        `#${[red, green, blue]
          .map((channel) => Number(channel).toString(16).padStart(2, '0'))
          .join('')}`
    )
    .replaceAll(/\b0px\b/g, '0')
    .replaceAll(/\s+/g, ' ')
}
