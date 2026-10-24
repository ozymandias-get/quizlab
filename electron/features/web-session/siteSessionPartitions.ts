/**
 * Where the data of a session partition lives on disk.
 *
 * The convention is the app's own: `<userData>/Partitions/<name>`, with the
 * `persist:` prefix dropped — the same folders the cache rules address (see
 * `electron/core/partitionPaths.ts`).
 *
 * The folder matters for one reason: a partition that was never used is not
 * there, and asking Electron for its session creates it. A user who never
 * opened a platform should not get an empty folder for it.
 */

import { promises as fs } from 'node:fs'

import { app } from 'electron'

import { getPartitionDirectory } from '../../core/partitionPaths.js'

/**
 * Whether the partition of a site exists on disk.
 *
 * A partition that is not there holds no session, and the check for one may
 * be skipped: resolving the session of a partition that does not exist would
 * create it.
 *
 * A path that cannot be resolved at all — the app is not ready yet — counts
 * as existing: the check is an optimisation, and a site that may have a
 * session is better read than reported as signed out.
 */
export async function partitionExistsOnDisk(partition: string): Promise<boolean> {
  try {
    await fs.access(getPartitionDirectory(app.getPath('userData'), partition))
    return true
  } catch (error) {
    // Only a folder that is not there says anything about the partition: every
    // other failure — the app is not ready yet, the path may not be read —
    // leaves the question open.
    const code = (error as NodeJS.ErrnoException)?.code
    return code !== 'ENOENT' && code !== 'ENOTDIR'
  }
}
