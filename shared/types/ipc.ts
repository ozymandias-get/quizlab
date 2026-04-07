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

export type IpcResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: IpcError
    }
