if (typeof window.__arabicFixerLoaded === "undefined") {
  window.__arabicFixerLoaded = true;
  const STYLE_ID = "bidi-fixer-style";

  function generateCSS(forceImportant) {
    const imp = forceImportant ? " !important" : "";

    if (!forceImportant) {
      return `
      :root { --arabic-dir: rtl; --arabic-align: start; }
      p, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, table, th, td {
        direction: var(--arabic-dir); text-align: var(--arabic-align);
      }
      input:not([type="url"]):not([type="email"]):not([type="tel"]):not([type="number"]):not([type="password"]),
      textarea, select {
        direction: var(--arabic-dir); text-align: var(--arabic-align);
      }
      pre, code, kbd, samp {
        direction: ltr !important; text-align: left !important; unicode-bidi: normal !important;
      }
    `;
    } else {
      return `
    :root { --arabic-dir: rtl; --arabic-align: start; }

    html, body {
      direction: var(--arabic-dir) !important;
      text-align: var(--arabic-align) !important;
    }

    pre, code, kbd, samp,
    pre *, code *,
    [class*="code"], [class*="hljs"],
    [class*="CodeMirror"], [class*="monaco-editor"] {
      direction: ltr !important;
      text-align: left !important;
      unicode-bidi: normal !important;
    }

    nav, aside, header, footer,
    [role="navigation"], [role="menu"], [role="menubar"],
    [class*="sidebar"], [class*="menu"], [class*="nav"],
    [class*="drawer"], [id*="sidebar"], [id*="menu"], [id*="nav"] {
      direction: ltr !important;
      text-align: left !important;
    }

    *[style*="flex"], *[style*="grid"] {
      direction: ltr !important;
    }
  `;
    }
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

  function detectPageRTL() {
    const sampleText = (document.body && document.body.innerText ? document.body.innerText : "").slice(
      0,
      3000,
    );
    if (!sampleText.trim()) return false;

    const rtlChars = sampleText.match(/[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g) || [];
    return rtlChars.length / sampleText.length > 0.15;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "APPLY_CSS_FIX") {
      applyStyles(request.enabled, request.forceImportant);
      sendResponse({ success: true });
    } else if (request.action === "DETECT_RTL") {
      sendResponse({ isRTL: detectPageRTL() });
    }
    return true;
  });

  (async () => {
    try {
      const domain = window.location.hostname.toLowerCase();

      const result = await chrome.storage.local.get([
        `site:${domain}`,
        "globalEnabled",
        "excludePatterns",
      ]);

      const siteSettings = result[`site:${domain}`];
      const globalEnabled = result.globalEnabled || false;
      const excludePatterns = result.excludePatterns || [];

      let isExcluded = false;
      for (const pattern of excludePatterns) {
        try {
          const regex = new RegExp(pattern, "i");
          if (regex.test(domain)) {
            console.log(`RTL Fixer: Domain ${domain} matches exclude pattern ${pattern}`);
            isExcluded = true;
            break;
          }
        } catch (error) {
          console.error(`RTL Fixer: Invalid exclude pattern ${pattern}:`, error);
        }
      }

      if (isExcluded) {
        console.log(`RTL Fixer: Skipping ${domain} due to exclude pattern`);
        return;
      }

      let isEnabled = false;
      let forceImportant = false;

      if (globalEnabled) {
        if (siteSettings && siteSettings.enabled === false) {
          isEnabled = false;
        } else {
          isEnabled = true;
          forceImportant = siteSettings ? siteSettings.forceImportant : false;
        }
      } else if (siteSettings && siteSettings.enabled) {
        isEnabled = true;
        forceImportant = siteSettings.forceImportant;
      }

      if (isEnabled) {
        applyStyles(true, forceImportant);
      }
    } catch (error) {
      console.error("RTL Fixer: Error during initialization:", error);
    }
  })();
}
