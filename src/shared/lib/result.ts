/**
 * Standard Result pattern for safe error handling.
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }

export const Result = {
  ok: <T>(value: T): Result<T, never> => ({ ok: true, value }),

  error: <E>(error: E): Result<never, E> => ({ ok: false, error }),

  fromPromise: async <T>(promise: Promise<T>): Promise<Result<T, unknown>> => {
    try {
      const value = await promise
      return Result.ok(value)
    } catch (err) {
      return Result.error(err)
    }
  },

  map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> => {
    if (result.ok) {
      return Result.ok(fn(result.value))
    }
    return result
  },

  unwrap: <T, E>(result: Result<T, E>): T => {
    if (result.ok) {
      return result.value
    }
    throw result.error
  },

  unwrapOr: <T, E>(result: Result<T, E>, defaultValue: T): T => {
    if (result.ok) {
      return result.value
    }
    return defaultValue
  }
}
