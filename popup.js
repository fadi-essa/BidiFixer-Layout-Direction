document.addEventListener("DOMContentLoaded", async () => {
  const domainNameEl = document.getElementById("domainName");
  const siteEnabled = document.getElementById("siteEnabled");
  const forceImportant = document.getElementById("forceImportant");
  const globalEnabled = document.getElementById("globalEnabled");
  const resetBtn = document.getElementById("resetBtn");
  const excludePatternsEl = document.getElementById("excludePatterns");
  const saveExcludeBtn = document.getElementById("saveExcludeBtn");
  
  // Read site preferences and global settings from sync storage
  const storage = await chrome.storage.sync.get(["sitePreferences", "globalEnabled", "excludePatterns"]);
  const prefs = storage.sitePreferences || {};
  const globalState = storage.globalEnabled || false;
  const excludePatterns = storage.excludePatterns || [];
  
  // Load exclude patterns into textarea
  if (excludePatterns.length > 0) {
    excludePatternsEl.value = excludePatterns.join('\n');
  }
  
  // تعيين حالة التبديل العام
  globalEnabled.checked = globalState;

  // 2. التحقق من الصفحة المفتوحة لمعرفة النطاق (Domain)
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  let currentDomain = null;

  if (activeTab && activeTab.url && activeTab.url.startsWith("http")) {
    currentDomain = new URL(activeTab.url).hostname.toLowerCase();
    domainNameEl.textContent = currentDomain;

    // Check if domain is excluded
    const excludePatterns = storage.excludePatterns || [];
    let isExcluded = false;
    for (const pattern of excludePatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(currentDomain)) {
          isExcluded = true;
          break;
        }
      } catch (error) {
        console.error("BidiFixer: Invalid exclude pattern:", error);
      }
    }

    // تطبيق الإعدادات الخاصة بالموقع (أو تعطيلها افتراضياً إذا كان الموقع جديداً)
    const siteSettings = prefs[currentDomain] || {
      enabled: null,
      forceImportant: false,
    };

    // If site has explicit setting, use it; otherwise show unchecked but will follow global
    if (siteSettings.enabled !== null) {
      siteEnabled.checked = siteSettings.enabled;
    } else {
      siteEnabled.checked = false;
      siteEnabled.indeterminate = !isExcluded && globalState; // Show indeterminate state when following global and not excluded
    }

    forceImportant.checked = siteSettings.forceImportant;
    forceImportant.disabled = !siteEnabled.checked;
    
    // Auto-detect RTL on popup open (removed - feature disabled)
  } else {
    // صفحة غير مدعومة (مثل إعدادات كروم أو تبويب فارغ)
    domainNameEl.textContent = "Unsupported Page";
    domainNameEl.style.color = "#ef4444";
    siteEnabled.disabled = true;
    forceImportant.disabled = true;
    resetBtn.disabled = true;
  }

  // Function to save site settings
  globalEnabled.addEventListener("change", async () => {
    await chrome.storage.sync.set({ globalEnabled: globalEnabled.checked });
    // Clear site-specific override if turning on global and site was disabled
    if (globalEnabled.checked && currentDomain) {
      const updatedStorage = await chrome.storage.sync.get(["sitePreferences"]);
      const updatedPrefs = updatedStorage.sitePreferences || {};
      if (updatedPrefs[currentDomain] && updatedPrefs[currentDomain].enabled === false) {
        delete updatedPrefs[currentDomain];
        await chrome.storage.sync.set({ sitePreferences: updatedPrefs });
        siteEnabled.checked = false;
        siteEnabled.indeterminate = true;
      }
    }
  });

  // Function to save site settings
  async function saveSiteSettings() {
    if (!currentDomain) return;
    const updatedStorage = await chrome.storage.sync.get(["sitePreferences"]);
    const updatedPrefs = updatedStorage.sitePreferences || {};

    updatedPrefs[currentDomain] = {
      enabled: siteEnabled.checked,
      forceImportant: forceImportant.checked,
    };

    await chrome.storage.sync.set({ sitePreferences: updatedPrefs });
    forceImportant.disabled = !siteEnabled.checked;
    siteEnabled.indeterminate = false;
  }

  siteEnabled.addEventListener("change", saveSiteSettings);
  forceImportant.addEventListener("change", saveSiteSettings);
  
  // Reset site settings button handler
  resetBtn.addEventListener("click", async () => {
    if (!currentDomain) return;
    
    const updatedStorage = await chrome.storage.sync.get(["sitePreferences"]);
    const updatedPrefs = updatedStorage.sitePreferences || {};
    
    if (updatedPrefs[currentDomain]) {
      delete updatedPrefs[currentDomain];
      await chrome.storage.sync.set({ sitePreferences: updatedPrefs });
      
      // Reset UI to reflect global state
      siteEnabled.checked = globalEnabled.checked;
      siteEnabled.indeterminate = !globalEnabled.checked;
      forceImportant.checked = false;
      forceImportant.disabled = true;
    }
  });
  
  // Save exclude patterns handler
  saveExcludeBtn.addEventListener("click", async () => {
    const patternsText = excludePatternsEl.value.trim();
    const patterns = patternsText ? patternsText.split('\n').map(p => p.trim()).filter(p => p.length > 0) : [];
    
    try {
      // Validate regex patterns
      for (const pattern of patterns) {
        new RegExp(pattern, 'i'); // Will throw if invalid
      }
      
      await chrome.storage.sync.set({ excludePatterns: patterns });
      
      // Show feedback
      const originalText = saveExcludeBtn.textContent;
      saveExcludeBtn.textContent = "Saved!";
      saveExcludeBtn.style.background = "#10b981";
      setTimeout(() => {
        saveExcludeBtn.textContent = originalText;
        saveExcludeBtn.style.background = "";
      }, 1500);
    } catch (error) {
      alert("Invalid regex pattern: " + error.message);
    }
  });
});
