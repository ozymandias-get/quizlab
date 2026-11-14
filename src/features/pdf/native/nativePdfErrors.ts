/**
 * Keeps a PDF.js failure to one safe line for the native viewer UI.
 *
 * PDF.js errors carry a stack trace and internal names (`PasswordException`,
 * `InvalidPDFException`, `RenderingCancelledException`, …). None of that belongs
 * in the UI, so only `message` is kept and it is bounded in length. The five
 * native layers share this rule rather than each carrying its own copy.
 */
export function toNativePdfErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return message.length > 200 ? message.slice(0, 200) : message
}
