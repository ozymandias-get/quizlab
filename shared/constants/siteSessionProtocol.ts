/**
 * The protocol the Chrome extension and the app agree on.
 *
 * The extension names the version it speaks on every request, and the app
 * reports its own in the site list. A mismatch tells the user to reload the
 * extension instead of leaving a connected extension that never imports.
 *
 * Version 3 added the Chrome profile id and name to every request, so the app
 * can run one extension instance per browser profile and select the source.
 */
export const SITE_SESSION_PROTOCOL_VERSION = 3
