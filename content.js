if (typeof window.__arabicFixerLoaded === "undefined") {
  window.__arabicFixerLoaded = true;
  const STYLE_ID = "bidi-fixer-style";

  function generateCSS(forceImportant) {
    const imp = forceImportant ? " !important" : "";
    return `
      :root { --arabic-dir: rtl; --arabic-align: start; }
      p, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, table, th, td {
        direction: var(--arabic-dir)${imp}; text-align: var(--arabic-align)${imp};
      }
      input:not([type="url"]):not([type="email"]):not([type="tel"]):not([type="number"]):not([type="password"]),
      textarea, select { direction: var(--arabic-dir)${imp}; text-align: var(--arabic-align)${imp}; }
      pre, code, kbd, samp { direction: ltr !important; text-align: left !important; unicode-bidi: normal !important; }
    `;
  }

  function applyStyles(enabled, forceImportant) {
    let styleEl = document.getElementById(STYLE_ID);
    if (enabled) {
      const cssCode = generateCSS(forceImportant);
      if (styleEl) styleEl.textContent = cssCode;
      else {
        styleEl = document.createElement("style");
        styleEl.id = STYLE_ID;
        styleEl.textContent = cssCode;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) styleEl.remove();
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "APPLY_CSS_FIX") {
      applyStyles(request.enabled, request.forceImportant);
      sendResponse({ success: true });
    }
    return true;
  });

  try {
    const domain = window.location.hostname.toLowerCase();
    chrome.storage.local.get(["sitePreferences"], (result) => {
      const prefs = result.sitePreferences || {};
      const siteSettings = prefs[domain];

      if (siteSettings && siteSettings.enabled) {
        applyStyles(true, siteSettings.forceImportant);
      }
    });
  } catch {}
}
