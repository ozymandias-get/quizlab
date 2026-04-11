import { GOOGLE_SIGNIN_URL } from './constants'
import type { LoginOptions, PlaywrightLoginResult } from './playwrightLoginTypes'
import { runPlaywrightSessionFlow, HEADLESS_REFRESH_INITIAL_URL } from './playwrightSessionFlow'

export type { ExternalBrowserCookie } from './playwrightCookieMapping'
export { hasCompletedGoogleLogin } from './playwrightLoginProbe'

export async function runPlaywrightLogin({
  profileDir,
  timeoutMs
}: LoginOptions): Promise<PlaywrightLoginResult> {
  return runPlaywrightSessionFlow({
    profileDir,
    timeoutMs,
    headless: false,
    successStreakTarget: 3,
    initialUrl: GOOGLE_SIGNIN_URL
  })
}

export async function runPlaywrightHeadlessRefresh({
  profileDir,
  timeoutMs
}: LoginOptions): Promise<PlaywrightLoginResult> {
  return runPlaywrightSessionFlow({
    profileDir,
    timeoutMs,
    headless: true,
    successStreakTarget: 2,
    initialUrl: HEADLESS_REFRESH_INITIAL_URL
  })
}
