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

type UnwrapIpcResult<R> = R extends IpcResult<infer T> ? T : R

export function success<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

export function failure(
  code: IpcErrorCode,
  message: string,
  details?: Record<string, unknown>
): IpcResult<never> {
  return { ok: false, error: { code, message, details } }
}
export function isFailure<T>(result: IpcResult<T>): result is { ok: false; error: IpcError } {
  return !result.ok
}
