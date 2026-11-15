import {
  extensionIdForEnvironment,
  extensionNameForEnvironment,
  QUIZLAB_DEV_EXTENSION_DESCRIPTION,
  QUIZLAB_DEV_EXTENSION_PUBLIC_KEY,
  type QuizlabEnvironment
} from '../../../shared/constants/extensionRelease.js'

/**
 * The two builds made from one extension source folder.
 *
 * The source folder `extensions/quizlab-session-extension` stays the only copy
 * of the code. A build is produced by copying that folder and, for the
 * development build, replacing the manifest identity: the name, the description
 * and the public key whose hash becomes the Chrome extension id.
 *
 * Everything that has to differ between the running builds is derived from this
 * descriptor, so a folder can never be prepared with the identity of the other
 * build by accident.
 */
export interface ExtensionVariant {
  environment: QuizlabEnvironment
  /** The id Chrome will derive from the manifest key. */
  extensionId: string
  /** The name Chrome shows for this build. */
  extensionName: string
  /** The folder Chrome loads, inside the app's user data directory. */
  folderName: string
  /**
   * The manifest the build is written with, or null when the source manifest is
   * used unchanged.
   */
  manifestRewrite: 'dev' | null
  /** The install marker of this build. The two builds never share one. */
  markerFileName: string
  /** The staging and backup folders of this build, next to its target folder. */
  stagingFolderName: string
  backupFolderName: string
}

const PROD_FOLDER = 'quizlab-session-extension'
const DEV_FOLDER = 'quizlab-session-extension-dev'

export function resolveExtensionVariant(environment: QuizlabEnvironment): ExtensionVariant {
  if (environment === 'dev') {
    return {
      environment,
      extensionId: extensionIdForEnvironment('dev'),
      extensionName: extensionNameForEnvironment('dev'),
      folderName: DEV_FOLDER,
      manifestRewrite: 'dev',
      markerFileName: '.install-dev.json',
      stagingFolderName: '.install-staging-dev',
      backupFolderName: '.install-backup-dev'
    }
  }

  return {
    environment,
    extensionId: extensionIdForEnvironment('prod'),
    extensionName: extensionNameForEnvironment('prod'),
    folderName: PROD_FOLDER,
    manifestRewrite: null,
    // The release names stay exactly what they were: an update of an existing
    // install must keep finding its own marker, staging and backup folders.
    markerFileName: '.install.json',
    stagingFolderName: '.install-staging',
    backupFolderName: '.install-backup'
  }
}

/**
 * The manifest of the development build, as deterministic text.
 *
 * Only the identity changes. Permissions, host permissions and the service
 * worker of the source are copied as they are, so the build is not a second
 * implementation with a second permission surface. The function is pure, so the
 * fingerprint of the prepared folder does not change between two installs that
 * copy the same source.
 */
export function buildDevManifestText(
  sourceManifest: Record<string, unknown>,
  extensionName: string
): string {
  const manifest: Record<string, unknown> = {
    ...sourceManifest,
    name: extensionName,
    description: QUIZLAB_DEV_EXTENSION_DESCRIPTION,
    key: QUIZLAB_DEV_EXTENSION_PUBLIC_KEY
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}
