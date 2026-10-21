/**
 * One lock per account of a site.
 *
 * The import of an account and the wipe of that account must not overlap. An
 * import that is already running would write its cookies *after* the wipe that
 * follows the switch, and the session the user just cancelled would come back
 * — permanently, because the switch is off and the extension is not allowed to
 * push the account any more.
 *
 * The lock is a promise chain per (site, account): the second caller waits for
 * the first one to finish. Two different accounts never wait for each other,
 * not even when they belong to the same site — the cookie jars are separate,
 * so an import into one cannot undo a wipe of the other. The chain of an
 * account is dropped as soon as it is idle.
 *
 * The key carries both ids. A site id may hold a colon (`custom:custom_…`)
 * and an account id comes from the state file, so neither can be the whole
 * key on its own.
 */

const SEPARATOR = '::'

/** The tail of the chain of every account that is busy. */
const chains = new Map<string, Promise<void>>()

/** The key of the account the task belongs to. */
function lockKey(siteId: string, accountId: string): string {
  return `${siteId}${SEPARATOR}${accountId}`
}

/**
 * Runs a task alone for the account it belongs to.
 *
 * The task runs after everything that was already running for that account,
 * and everything that comes after it waits for it. A task that fails does not
 * keep the next one from running: the chain only ever holds promises that
 * settle.
 */
export async function withSiteSessionLock<T>(
  siteId: string,
  accountId: string,
  task: () => Promise<T>
): Promise<T> {
  const key = lockKey(siteId, accountId)
  const previous = chains.get(key) ?? Promise.resolve()
  const result = previous.then(task)

  const settled = result.then(
    () => undefined,
    () => undefined
  )
  chains.set(key, settled)

  // The chain of an idle account is dropped: a map that grows with every
  // account the user ever touched would keep them alive for the whole session.
  void settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key)
  })

  return result
}
