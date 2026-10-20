/**
 * One lock per site.
 *
 * The import of a site and the switch of that site must not overlap. An
 * import that is already running would write its cookies *after* the wipe
 * that follows the switch, and the session the user just cancelled would
 * come back — permanently, because the switch is off and the extension is
 * not allowed to push the site any more.
 *
 * The lock is a promise chain per site id: the second caller waits for the
 * first one to finish. Two different sites never wait for each other, and the
 * chain of a site is dropped as soon as it is idle.
 */

/** The tail of the chain of every site that is busy. */
const chains = new Map<string, Promise<void>>()

/**
 * Runs a task alone for the site it belongs to.
 *
 * The task runs after everything that was already running for that site, and
 * everything that comes after it waits for it. A task that fails does not
 * keep the next one from running: the chain only ever holds promises that
 * settle.
 */
export async function withSiteSessionLock<T>(siteId: string, task: () => Promise<T>): Promise<T> {
  const previous = chains.get(siteId) ?? Promise.resolve()
  const result = previous.then(task)

  const settled = result.then(
    () => undefined,
    () => undefined
  )
  chains.set(siteId, settled)

  // The chain of an idle site is dropped: a map that grows with every site
  // the user ever touched would keep them alive for the whole session.
  void settled.then(() => {
    if (chains.get(siteId) === settled) chains.delete(siteId)
  })

  return result
}
