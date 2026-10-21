/**
 * Where the data of a session partition lives on disk.
 *
 * Chromium keeps the data of a `persist:` partition under
 * `<userData>/Partitions/<name>`: the `persist:` prefix is dropped and the
 * characters a path may not hold are replaced.
 *
 * The folder is computed once, here, because three places address it: the
 * cache rules of the system handlers, the rules of the cache registry and the
 * session feature, which asks whether a partition was ever used.
 */

import path from 'node:path'

/**
 * The name of the folder a partition keeps its data in.
 */
export function getPartitionDirectoryName(partition: string): string {
  return partition.replace(/^persist:/, '').replaceAll(/["*/:<>?\\|]/g, '_')
}

/**
 * The folder a partition keeps its data in, under the given user data folder.
 */
export function getPartitionDirectory(userDataPath: string, partition: string): string {
  return path.join(userDataPath, 'Partitions', getPartitionDirectoryName(partition))
}
