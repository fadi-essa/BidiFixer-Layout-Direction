document.addEventListener("DOMContentLoaded", async () => {
  const domainNameEl = document.getElementById("domainName");
  const siteEnabled = document.getElementById("siteEnabled");
  const forceImportant = document.getElementById("forceImportant");
  const globalEnabled = document.getElementById("globalEnabled");
  const resetBtn = document.getElementById("resetBtn");
  const excludePatternsEl = document.getElementById("excludePatterns");
  const saveExcludeBtn = document.getElementById("saveExcludeBtn");
  const siteStatusHint = document.getElementById("siteStatusHint");

  let currentDomain = null;

  const storage = await chrome.storage.local.get(["globalEnabled", "excludePatterns"]);
  const globalState = storage.globalEnabled || false;
  const excludePatterns = storage.excludePatterns || [];

  if (excludePatterns.length > 0) {
    excludePatternsEl.value = excludePatterns.join("\n");
  }

  globalEnabled.checked = globalState;

  async function safeStorageSet(obj) {
    try {
      await chrome.storage.local.set(obj);
      return true;
    } catch (error) {
      console.error("RTL Fixer: storage write failed:", error);
      alert("Couldn't save settings (storage write failed). Try again, or clear some site settings.");
      return false;
    }
  }


  function refreshSiteEnabledUI(explicitEnabled, isExcluded) {
    if (isExcluded) {
      siteEnabled.checked = false;
      siteStatusHint.textContent = "Excluded via URL pattern";
      return;
    }

    if (explicitEnabled === null || explicitEnabled === undefined) {
      const effective = globalEnabled.checked;
      siteEnabled.checked = effective;
      siteStatusHint.textContent = `Following global setting (currently ${effective ? "ON" : "OFF"})`;
    } else {
      siteEnabled.checked = explicitEnabled;
      siteStatusHint.textContent = `Explicitly set ${explicitEnabled ? "ON" : "OFF"} for this site`;
    }
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  let isExcluded = false;

  if (activeTab && activeTab.url && activeTab.url.startsWith("http")) {
    currentDomain = new URL(activeTab.url).hostname.toLowerCase();
    domainNameEl.textContent = currentDomain;

    for (const pattern of excludePatterns) {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(currentDomain)) {
          isExcluded = true;
          break;
        }
      } catch (error) {
        console.error("RTL Fixer: Invalid exclude pattern:", error);
      }
    }

    const siteData = await chrome.storage.local.get([`site:${currentDomain}`]);
    const siteSettings = siteData[`site:${currentDomain}`] || { enabled: null, forceImportant: false };

    refreshSiteEnabledUI(siteSettings.enabled, isExcluded);

    forceImportant.checked = !!siteSettings.forceImportant;
    forceImportant.disabled = isExcluded || !siteEnabled.checked;
    siteEnabled.disabled = isExcluded;
  } else {
    domainNameEl.textContent = "Unsupported Page";
    domainNameEl.style.color = "#ef4444";
    siteEnabled.disabled = true;
    forceImportant.disabled = true;
    resetBtn.disabled = true;
    siteStatusHint.textContent = "Not available on this page";
  }

  globalEnabled.addEventListener("change", async () => {
    const ok = await safeStorageSet({ globalEnabled: globalEnabled.checked });
    if (!ok) {
      globalEnabled.checked = !globalEnabled.checked;
      return;
    }

    if (!currentDomain || isExcluded) return;

    const data = await chrome.storage.local.get([`site:${currentDomain}`]);
    const existing = data[`site:${currentDomain}`];

    if (globalEnabled.checked && existing && existing.enabled === false) {
      await chrome.storage.local.remove(`site:${currentDomain}`);
      refreshSiteEnabledUI(null, false);
      forceImportant.checked = false;
      forceImportant.disabled = !siteEnabled.checked;
      return;
    }

    if (!existing || existing.enabled === null || existing.enabled === undefined) {
      refreshSiteEnabledUI(null, false);
    }
  });

  async function saveSiteEnabled() {
    if (!currentDomain) return;
    const data = await chrome.storage.local.get([`site:${currentDomain}`]);
    const existing = data[`site:${currentDomain}`] || {};

    const ok = await safeStorageSet({
      [`site:${currentDomain}`]: {
        ...existing,
        enabled: siteEnabled.checked,
        forceImportant: forceImportant.checked,
      },
    });
    if (!ok) return;

    forceImportant.disabled = !siteEnabled.checked;
    siteStatusHint.textContent = `Explicitly set ${siteEnabled.checked ? "ON" : "OFF"} for this site`;
  }

  async function saveForceImportantOnly() {
    if (!currentDomain) return;
    const data = await chrome.storage.local.get([`site:${currentDomain}`]);
    const existing = data[`site:${currentDomain}`];

    const hasExplicitEnabled =
      existing && existing.enabled !== null && existing.enabled !== undefined;

    await safeStorageSet({
      [`site:${currentDomain}`]: {
        enabled: hasExplicitEnabled ? existing.enabled : null,
        forceImportant: forceImportant.checked,
      },
    });
  }

  siteEnabled.addEventListener("change", saveSiteEnabled);
  forceImportant.addEventListener("change", saveForceImportantOnly);


  resetBtn.addEventListener("click", async () => {
    if (!currentDomain) return;

    await chrome.storage.local.remove(`site:${currentDomain}`);

    refreshSiteEnabledUI(null, false);
    forceImportant.checked = false;
    forceImportant.disabled = !siteEnabled.checked;
  });

  saveExcludeBtn.addEventListener("click", async () => {
    const patternsText = excludePatternsEl.value.trim();
    const patterns = patternsText
      ? patternsText.split("\n").map((p) => p.trim()).filter((p) => p.length > 0)
      : [];

    try {
      for (const pattern of patterns) {
        new RegExp(pattern, "i"); 

        if (pattern.length > 200) {
          throw new Error(`Pattern "${pattern}" is too long (max 200 characters)`);
        }
        if (/(\([^)]*[+*][^)]*\)[+*])/.test(pattern)) {
          throw new Error(
            `Pattern "${pattern}" looks like it could cause catastrophic backtracking`,
          );
        }
      }

      const ok = await safeStorageSet({ excludePatterns: patterns });
      if (!ok) return;

      const originalText = saveExcludeBtn.textContent;
      saveExcludeBtn.textContent = "Saved!";
      saveExcludeBtn.style.background = "#10b981";
      setTimeout(() => {
        saveExcludeBtn.textContent = originalText;
        saveExcludeBtn.style.background = "";
      }, 1500);
    } catch (error) {
      alert("Invalid exclude pattern: " + error.message);
    }
  });
});
