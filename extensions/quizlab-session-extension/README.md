# Quizlab Site Session Bridge

The app's web chat services have local brand icons and Chrome session targets.
Gemini, AI Studio, YouTube, Google Drive and NotebookLM share the **Google**
target and partition. API Chat has no browser session to import.

## Install the extension separately

The extension is no longer copied into the app. It is shipped as its own
release artifact and installed by the user:

1. Download the extension package from the release page linked in the app's
   **Settings → Site Sessions** card and unzip it.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**
   and select the unzipped folder (version **1.4.0**). The extension key and
   identity are unchanged.
3. In Quizlab, open **Settings → Site Sessions** and press **Eşleştir**. Copy
   the pairing code.
4. Open the extension popup, paste the code and press **Eşleştir**.
5. Sign in to the desired service in Chrome.
6. In Quizlab, enable that service's switch. This is separate from enabling
   its launcher in **Models**.
7. In the extension popup, press **İzin ver** for a new service and grant the
   requested site domains. Then import its session.

## More than one Chrome profile

Each Chrome profile has its own `chrome.storage.local`, so the same extension
folder can be loaded in every profile and each copy pairs independently with the
same Quizlab install. Give each copy a name in the extension popup (**Bu Chrome
profili**); the name is shown on the toolbar button and in Quizlab's Chrome
profile picker. Quizlab imports sessions from the selected profile only and
refuses signed packets from the other profiles, so two signed-in Chrome profiles
never overwrite each other. Switching the source also forgets the sessions the
app imported from the previous profile, so the old account is not left signed
in while the row points at the new profile.

The app never writes a secret into the extension package and never hands the
pairing code out over HTTP. The extension stores the code in
`chrome.storage.local`, and every site-list and cookie request is signed with
it. Only targets enabled in Quizlab are sent to the extension. The worker
checks permission before reading cookies, reports missing permission without
reading the cookie jar, and signs each site's packet separately. The app
validates the site, enabled switch and cookie domain before writing to that
site's partition.

## Limits of cookie import

The bridge transfers cookies, including HttpOnly cookies supported by Chrome's
cookies API. It does not copy localStorage, IndexedDB, browser device keys or
partitioned third-party cookies. A service which binds authentication to those
stores, requires re-verification, or rejects embedded browsers can still require
manual sign-in in Quizlab. An imported-cookie status confirms the write, not a
successful authenticated visit to the service.

Domain configuration is in `shared/constants/siteSessionCookieDomains.ts`.
Provider-specific auth domains should be added only when verified; unrelated
account domains are not collected speculatively. Real authenticated Chrome/Electron
login checks are separate from the mocked bridge, permission and routing tests.
