/**
 * The protocol the Chrome extension and the app agree on.
 *
 * The extension names the version it speaks on every request, and the app
 * reports its own in the site list. A mismatch tells the user to reload the
 * extension instead of leaving a connected extension that never imports.
 *
 * Version 3 added the Chrome profile id and name to every request, so the app
 * can run one extension instance per browser profile and select the source.
 *
 * The release and development builds share this version. The health answer also
 * names the environment (`dev`/`prod`) and the extension names its own in a
 * request header; both fields are additive, so an older extension that ignores
 * them keeps working against the app it was paired with.
 */
export const SITE_SESSION_PROTOCOL_VERSION = 3
