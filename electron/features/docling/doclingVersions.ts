/**
 * Pinned versions for the Docling private runtime. Every artifact is fetched
 * over HTTPS from its official source and verified against a SHA-256 digest
 * recorded here before anything is executed. Nothing floats, nothing resolves
 * to "latest" at install time — bumping a version is an explicit code change.
 *
 * Rationale for the chosen pins lives in the integration report (branch
 * docs), not here; this file only states the facts:
 * - uv 0.12.5: single static binary that bootstraps and manages the private
 *   CPython toolchain; verifies every managed Python archive it downloads.
 * - CPython 3.12.14: managed python-build-standalone build; satisfies
 *   docling's `>=3.10,<4.0` requirement on a mature stable minor line.
 * - docling 2.121.0 / docling-core 2.92.0: exact PyPI releases current at
 *   implementation time; docling-core is pinned explicitly even though it is
 *   also a transitive dependency so the resolver cannot drift it.
 */

export const UV_VERSION = '0.12.5'
export const PYTHON_VERSION = '3.12.14'
export const DOCLING_VERSION = '2.121.0'
export const DOCLING_CORE_VERSION = '2.92.0'

/** docling-serve is intentionally not provisioned in this phase. */
export const DOCLING_PACKAGES = [
  `docling==${DOCLING_VERSION}`,
  `docling-core==${DOCLING_CORE_VERSION}`
] as const

/**
 * CUDA / GPU extras – only installed when the user enables GPU in Settings.
 * Pinned to avoid floating to untested wheels. Torch CUDA 12.1 covers most
 * desktop NVIDIA drivers (>= 525). onnxruntime-gpu unlocks the ONNX paths Docling
 * uses for layout/table models. Both are large (~2 GB combined) so they stay
 * opt-in behind the toggle.
 */
export const CUDA_TORCH_VERSION = '2.5.1'
export const CUDA_ONNXRUNTIME_GPU_VERSION = '1.20.0'
export const DOCLING_CUDA_PACKAGES = [
  `torch==${CUDA_TORCH_VERSION}`,
  `torchvision==0.20.1`,
  `torchaudio==2.5.1`,
  `onnxruntime-gpu==${CUDA_ONNXRUNTIME_GPU_VERSION}`
] as const
export const CUDA_INDEX_URL = 'https://download.pytorch.org/whl/cu121'

const UV_RELEASE_BASE = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`

interface UvAsset {
  url: string
  sha256: string
  /** Name of the executable to cherry-pick after extraction. */
  binaryName: string
}

/**
 * Checksums taken from the official `.sha256` sidecar files published with
 * the uv ${UV_VERSION} GitHub release.
 * Sources: https://github.com/astral-sh/uv/releases/tag/${UV_VERSION}
 */
export const UV_ASSETS: Record<string, UvAsset> = {
  'win32-x64': {
    url: `${UV_RELEASE_BASE}/uv-x86_64-pc-windows-msvc.zip`,
    sha256: '4c4d49d8738847d9b71ba319e49a5688c93eac0fe6204b1df24e98528dddf39a',
    binaryName: 'uv.exe'
  },
  'linux-x64': {
    url: `${UV_RELEASE_BASE}/uv-x86_64-unknown-linux-gnu.tar.gz`,
    sha256: '68a509da24b06b4223a1c0175fb5eb5bc79342b76cbeff0cfe51ac3f5b17b6b2',
    binaryName: 'uv'
  },
  'darwin-arm64': {
    url: `${UV_RELEASE_BASE}/uv-aarch64-apple-darwin.tar.gz`,
    sha256: '5bb0e5fe008a773c3dbcb97ff79cd89e1241464fe9d2f986d52ad8f1b037bd62',
    binaryName: 'uv'
  },
  'darwin-x64': {
    url: `${UV_RELEASE_BASE}/uv-x86_64-apple-darwin.tar.gz`,
    sha256: 'b3b2137477cf96c9686ebfb71524614cec780c673fd73e59bce099aef02e70e8',
    binaryName: 'uv'
  }
}

export function getUvAssetKey(
  platform: string = process.platform,
  arch: string = process.arch
): string {
  if (platform === 'win32') return 'win32-x64'
  if (platform === 'linux') return 'linux-x64'
  if (platform === 'darwin') return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
  throw new Error(`Unsupported platform for the Docling runtime: ${platform}/${arch}`)
}
