# Quizlab Site Session Bridge

The app's web chat services have local brand icons and Chrome session targets.
Gemini, AI Studio, YouTube, Google Drive and NotebookLM share the **Google**
target and partition. API Chat has no browser session to import.

## Two builds of one source

This folder is the only copy of the extension code. The app prepares one of two
builds from it; the build is decided by the manifest `key`, because Chrome
derives the extension id from that key:

|              | Release build                 | Development build                   |
| ------------ | ----------------------------- | ----------------------------------- |
| Chrome name  | `Quizlab Site Session Bridge` | `Quizlab Site Session Bridge (Dev)` |
| Prepared by  | the installed app             | `npm run dev`                       |
| Bridge ports | `51999-52009`                 | `52010-52020`                       |
| Pairs with   | the installed app only        | the development app only            |

Both builds can be loaded in the same Chrome profile at the same time. They have
different ids, so `chrome.storage.local` (pairing code, profile name, queue) is
separate, and each one scans only its own port range. The bridge of each app
accepts only its own extension origin, its own pairing secret and requests that
name the matching environment, so a development extension cannot reach the
installed app and vice versa.

The public key of the development build lives in
`shared/constants/extensionRelease.ts`. Its private half was discarded on
purpose: an unpacked extension only needs the public key to pin its id, and no
secret belongs in the repository.

## Install the extension from the app

The extension ships inside Quizlab Reader; there is no separate download.

1. In Quizlab, open **Settings → Session Import** and press **Install**
   (**Eklentiyi kur**). The app copies the bundled extension to a stable
   folder under its user-data directory and puts that folder's path on the
   clipboard.
2. Open `chrome://extensions`, enable Developer mode and choose **Load
   unpacked**. Paste the copied path into the folder picker.
3. In Quizlab press **Eşleştir** and copy the pairing code.
4. Open the extension side panel, paste the code and press **Eşleştir**.
5. Sign in to the desired service in Chrome.
6. In Quizlab, enable that service's switch. This is separate from enabling
   its launcher in **Models**.
7. In the extension side panel, press **İzin ver** for a new service and grant the
   requested site domains. Then import its session.

An app update refreshes the copied folder under the same path. Reload the
extension from `chrome://extensions` after an update.

## Magic Selector

The side panel can also pick the elements Quizlab's automation targets. The feature
is part of this extension; there is no second extension and no extra build.

1. Open the AI site in Chrome and press the extension icon.
2. Under **Sihirli Seçici**, choose the target field (**Mesaj giriş alanı** or
   **Mesaj gönder butonu**) and press **Sihirli Seçici'yi Başlat**.
3. Move the pointer over the page and click the element. The click never reaches
   the page: no message is sent, no file dialog opens and no link is followed.
   `Esc` cancels.
4. Confirm the pick in the page panel. The selector is sent to Quizlab, which
   verifies it in its own view of the same site and stores it. The old selector
   stays untouched until that verification succeeds.

The page-side picker is injected on demand (`content/picker.js` plus the
generated `content/selector-engine.js`) and removes every listener and overlay
when it finishes. It never holds the pairing code and never talks to the bridge
itself: signing happens in the service worker. `content/selector-engine.js` is
generated from the Electron picker sources with
`npm run generate:extension-engine`; `npm run ci:check-extension-engine` fails
when the committed file is stale.

If Quizlab does not have the site open, the transfer is refused
(`site_not_open`) instead of writing an unverified selector. Open the site in
Quizlab and send the same pick again. A pick works while **Siteleri Chrome ile
otomatik eşitle** is off: the selector transfer has its own endpoint and never
touches the cookie queue.

## Develop against the extension

1. Run `npm run dev`. The development app prepares its own folder under the
   development user-data directory (`…/Quizlab Reader Dev/extension/
quizlab-session-extension-dev`) on every start.
2. Open **Settings → Session Import → Install extension** in the development app
   and copy the reported path.
3. Load that folder once in `chrome://extensions` (Developer mode → Load
   unpacked). Chrome shows it as **Quizlab Site Session Bridge (Dev)**.
4. Pair this build once with the development app's code. The release pairing is
   untouched; the two builds keep separate secrets and separate Chrome storage.
5. After a source change, restart `npm run dev` so the folder is refreshed, then
   press **Reload** on the extension card in `chrome://extensions`. Chrome does
   not reload an unpacked extension by itself, and the app never installs
   anything silently.

The development app never accepts the release extension, and the release app
never accepts the development one. If both apps run, each extension keeps
talking to its own app.

## More than one Chrome profile

Each Chrome profile has its own `chrome.storage.local`, so the same extension
folder can be loaded in every profile and each copy pairs independently with the
same Quizlab install. Give each copy a name in the extension side panel (**Bu Chrome
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
