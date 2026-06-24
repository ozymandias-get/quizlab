# Task 5: Add Encrypted Fallback for Linux When `safeStorage` Is Unavailable

## What I Implemented

Replaced `electron/core/encryption.ts` with an implementation that adds AES-256-GCM fallback encryption:

- **`getMachineDerivedKey()`** — derives a 32-byte key via PBKDF2 using `MACHINE_ID` env var, `COMPUTERNAME` (win32), or a fixed fallback
- **`aesEncrypt()` / `aesDecrypt()`** — AES-256-GCM encrypt/decrypt with random IV and auth tag, stored with `aes:` prefix
- **`encryptValue()`** — tries `safeStorage.encryptString` first, falls back to `aesEncrypt`, then plaintext as last resort
- **`decryptValue()`** — handles `aes:` prefix (AES), `enc:` prefix (safeStorage), and legacy plaintext

## What I Tested

- Ran `npx tsc -b --force` — only pre-existing `normalizePdfText.ts` error, no new type errors from `encryption.ts`

## Files Changed

- `electron/core/encryption.ts` — 66 insertions, 49 deletions (full replacement)

## Self-Review Findings

- The `isEncryptionAvailable()` function is no longer exported (was previously private). This is fine — no other file imported it.
- The `aesEncrypt` output format `aes:{ivBase64}:{authTagHex}:{ciphertextHex}` is clean and non-ambiguous since colons after the first two sections are part of the ciphertext.
- PBKDF2 iteration count (100,000) is reasonable and matches current OWASP recommendations for non-critical keys.

## Issues or Concerns

None.
