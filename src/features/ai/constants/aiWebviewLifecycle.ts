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

  // Observe only direct children of body (not the entire subtree) to avoid
  // firing on every chat message / text update inside AI web apps.
  observer.observe(document.body, { childList: true });

  timeout = setTimeout(() => {
    cleanup();
    resolve(false);
  }, 4000);
})
`
