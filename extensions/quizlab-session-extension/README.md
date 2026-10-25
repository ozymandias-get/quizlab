# Quizlab Site Session Bridge

The app's 50 web chat services have local brand icons and Chrome session targets.
Gemini, AI Studio, YouTube, Google Drive and NotebookLM share the **Google** target
and partition. API Chat has no browser session to import.

## Use the updated extension

1. Restart Quizlab Reader after rebuilding its Electron main process.
2. Open `chrome://extensions` and reload the unpacked extension from this folder
   (version **1.1.0**). The extension key and identity are unchanged.
3. Sign in to the desired service in Chrome.
4. In Quizlab, open **Settings → Session Import** and enable that service's switch.
   This is separate from enabling its launcher in **Models**.
5. Open the Chrome extension popup. For a new service, press **İzin ver** and grant
   the requested site domains. Then select the service and import its session.

Existing host grants are unchanged. New catalogue sites use the optional host
permission flow, so adding the catalogue does not grant access to every site.
Only targets enabled in Quizlab are sent to the extension. The worker checks
permission before reading cookies, reports missing permission without reading
the cookie jar, and signs each site's packet separately. The app validates the
site, enabled switch and cookie domain before writing to that site's partition.

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
