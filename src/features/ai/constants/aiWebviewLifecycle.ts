/** Max tab ids kept warm (includes active); 1 => active only, no background webviews. */
export const MAX_ALIVE_UNPINNED_TABS = 1

/** Inactive mounted sessions sleep after this interval (webview unmounts). */
export const AI_TAB_SLEEP_MS = 60 * 1000

export const STALE_CONTENT_DETECTION_SCRIPT = `
new Promise((resolve) => {
  if (document.hidden) return resolve(false);

  const check = () => {
    const hasComposer = Boolean(
      document.querySelector(
        'textarea, [contenteditable="true"][role="textbox"], div[role="textbox"]'
      )
    );
    if (hasComposer) return false;
    
    const container = document.querySelector('main, #root, #__next, .error-page') || document.body;
    if (!container) return false;
    
    const t = (container.textContent || '').toLowerCase();
    return (
      t.includes('could not be loaded') ||
      t.includes("couldn't be loaded") ||
      t.includes('yüklenemedi') ||
      t.includes("doesn't exist") ||
      t.includes('mevcut değil') ||
      t.includes('no longer available') ||
      t.includes('conversation not found') ||
      t.includes('silinmiş')
    );
  };

  if (check()) return resolve(true);

  let observer;
  let timeout;

  const cleanup = () => {
    if (observer) observer.disconnect();
    if (timeout) clearTimeout(timeout);
  };

  observer = new MutationObserver(() => {
    if (check()) {
      cleanup();
      resolve(true);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  timeout = setTimeout(() => {
    cleanup();
    resolve(false);
  }, 12500);
})
`
