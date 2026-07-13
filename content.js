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

  // Debounce timer for CSS re-application
  let debounceTimer = null;
  
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

  // MutationObserver for dynamic content (SPAs like Gmail, Twitter, etc.)
  let observer = null;
  function setupMutationObserver(forceImportant) {
    if (observer) observer.disconnect();
    
    observer = new MutationObserver((mutations) => {
      let shouldReapply = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldReapply = true;
          break;
        }
      }
      
      if (shouldReapply) {
        // Debounce re-application to avoid performance issues
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const styleEl = document.getElementById(STYLE_ID);
          if (styleEl) {
            // Force reflow to ensure styles are applied to new elements
            void styleEl.offsetWidth;
          }
        }, 100); // 100ms debounce
      }
    });
    
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "APPLY_CSS_FIX") {
      applyStyles(request.enabled, request.forceImportant);
      if (request.enabled) {
        setupMutationObserver(request.forceImportant);
      } else if (observer) {
        observer.disconnect();
        observer = null;
      }
      sendResponse({ success: true });
    }
    return true;
  });

  // Cleanup on page unload to prevent memory leaks
  window.addEventListener('unload', () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  });

  try {
    const domain = window.location.hostname.toLowerCase();
    
    // Wait for storage to be ready before applying styles (fix race condition)
    chrome.storage.sync.get(["sitePreferences", "globalEnabled", "excludePatterns"], (result) => {
      if (chrome.runtime.lastError) {
        console.error("RTL Fixer: Storage access error:", chrome.runtime.lastError);
        return;
      }
      
      const prefs = result.sitePreferences || {};
      const globalEnabled = result.globalEnabled || false;
      const excludePatterns = result.excludePatterns || [];
      const siteSettings = prefs[domain];

      // Check if domain matches any exclude pattern
      let isExcluded = false;
      if (excludePatterns.length > 0) {
        for (const pattern of excludePatterns) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(domain)) {
              console.log(`RTL Fixer: Domain ${domain} matches exclude pattern ${pattern}`);
              isExcluded = true;
              break;
            }
          } catch (error) {
            console.error(`RTL Fixer: Invalid exclude pattern ${pattern}:`, error);
          }
        }
      }
      
      if (isExcluded) {
        console.log(`RTL Fixer: Skipping ${domain} due to exclude pattern`);
        return;
      }

      let isEnabled = false;
      let forceImportant = false;

      if (globalEnabled) {
        // If global is enabled, check if site has explicit disable
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
        setupMutationObserver(forceImportant);
      }
    });
  } catch (error) {
    console.error("RTL Fixer: Error during initialization:", error);
  }
}
