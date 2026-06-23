/**
 * Runtime guards for IPC payloads. Renderer-supplied values are `unknown` at the trust boundary;
 * never rely on TypeScript annotations alone for security-relevant coercions.
 */
export function toStrictBoolean(value: unknown): boolean {
  if (value === true) return true
  if (value === false) return false
  return false
}
