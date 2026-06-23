export type IpcErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'already_exists'
  | 'unauthorized'
  | 'internal_error'

export type IpcError = {
  code: IpcErrorCode
  message: string
  details?: Record<string, unknown>
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }

export function success<T>(payload: T): IpcResult<T> {
  return { ok: true, data: payload }
}

export function failure(
  code: IpcErrorCode,
  message: string,
  details?: Record<string, unknown>
): IpcResult<never> {
  return { ok: false, error: { code, message, details } }
}
