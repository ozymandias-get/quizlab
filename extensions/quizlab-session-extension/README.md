# Quizlab Site Session Bridge

The app's web chat services have local brand icons and Chrome session targets.
Gemini, AI Studio, YouTube, Google Drive and NotebookLM share the **Google**
target and partition. API Chat has no browser session to import.

## Install the extension from the app

The extension ships inside Quizlab Reader; there is no separate download.

1. In Quizlab, open **Settings → Site Sessions** and press **Install**
   (**Eklentiyi kur**). The app copies the bundled extension to a stable
   folder under its user-data directory and puts that folder's path on the
   clipboard.
2. Open `chrome://extensions`, enable Developer mode and choose **Load
   unpacked**. Paste the copied path into the folder picker.
3. In Quizlab press **Eşleştir** and copy the pairing code.
4. Open the extension popup, paste the code and press **Eşleştir**.
5. Sign in to the desired service in Chrome.
6. In Quizlab, enable that service's switch. This is separate from enabling
   its launcher in **Models**.
7. In the extension popup, press **İzin ver** for a new service and grant the
   requested site domains. Then import its session.

An app update refreshes the copied folder under the same path. Reload the
extension from `chrome://extensions` after an update.

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
