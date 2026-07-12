document.addEventListener("DOMContentLoaded", async () => {
  const domainNameEl = document.getElementById("domainName");
  const siteEnabled = document.getElementById("siteEnabled");
  const forceImportant = document.getElementById("forceImportant");
  const globalEnabled = document.getElementById("globalEnabled");
  const rtlIndicator = document.getElementById("rtlIndicator");
  const detectRtlBtn = document.getElementById("detectRtlBtn");
  const resetBtn = document.getElementById("resetBtn");
  
  // 1. قراءة إعدادات المواقع المحفوظة والإعداد العام
  const storage = await chrome.storage.local.get(["sitePreferences", "globalEnabled"]);
  const prefs = storage.sitePreferences || {};
  const globalState = storage.globalEnabled || false;
  
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
      siteEnabled.indeterminate = true; // Show indeterminate state when following global
    }

    forceImportant.checked = siteSettings.forceImportant;
    forceImportant.disabled = !siteEnabled.checked;
    
    // Auto-detect RTL on popup open
    detectRTLContent();
  } else {
    // صفحة غير مدعومة (مثل إعدادات كروم أو تبويب فارغ)
    domainNameEl.textContent = "Unsupported Page";
    domainNameEl.style.color = "#ef4444";
    siteEnabled.disabled = true;
    forceImportant.disabled = true;
    detectRtlBtn.disabled = true;
    resetBtn.disabled = true;
  }

  // Function to detect RTL content in the current page
  async function detectRTLContent() {
    if (!currentDomain) return;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: "DETECT_RTL" }, (response) => {
        if (chrome.runtime.lastError) {
          console.log("BidiFixer: Could not detect RTL - content script not ready");
          return;
        }
        if (response && response.isRTL) {
          rtlIndicator.classList.add("visible");
        } else {
          rtlIndicator.classList.remove("visible");
        }
      });
    } catch (error) {
      console.log("BidiFixer: RTL detection error:", error);
      rtlIndicator.classList.remove("visible");
    }
  }

  // 3. دالة الحفظ للإعداد العام
  globalEnabled.addEventListener("change", async () => {
    await chrome.storage.local.set({ globalEnabled: globalEnabled.checked });
    // Clear site-specific override if turning on global and site was disabled
    if (globalEnabled.checked && currentDomain) {
      const updatedStorage = await chrome.storage.local.get(["sitePreferences"]);
      const updatedPrefs = updatedStorage.sitePreferences || {};
      if (updatedPrefs[currentDomain] && updatedPrefs[currentDomain].enabled === false) {
        delete updatedPrefs[currentDomain];
        await chrome.storage.local.set({ sitePreferences: updatedPrefs });
        siteEnabled.checked = false;
        siteEnabled.indeterminate = true;
      }
    }
  });

  // 4. دالة الحفظ للموقع الحالي
  async function saveSiteSettings() {
    if (!currentDomain) return;
    const updatedStorage = await chrome.storage.local.get(["sitePreferences"]);
    const updatedPrefs = updatedStorage.sitePreferences || {};

    updatedPrefs[currentDomain] = {
      enabled: siteEnabled.checked,
      forceImportant: forceImportant.checked,
    };

    await chrome.storage.local.set({ sitePreferences: updatedPrefs });
    forceImportant.disabled = !siteEnabled.checked;
    siteEnabled.indeterminate = false;
  }

  siteEnabled.addEventListener("change", saveSiteSettings);
  forceImportant.addEventListener("change", saveSiteSettings);
  
  // Detect RTL button handler
  detectRtlBtn.addEventListener("click", detectRTLContent);
  
  // Reset site settings button handler
  resetBtn.addEventListener("click", async () => {
    if (!currentDomain) return;
    
    const updatedStorage = await chrome.storage.local.get(["sitePreferences"]);
    const updatedPrefs = updatedStorage.sitePreferences || {};
    
    if (updatedPrefs[currentDomain]) {
      delete updatedPrefs[currentDomain];
      await chrome.storage.local.set({ sitePreferences: updatedPrefs });
      
      // Reset UI to reflect global state
      siteEnabled.checked = globalEnabled.checked;
      siteEnabled.indeterminate = !globalEnabled.checked;
      forceImportant.checked = false;
      forceImportant.disabled = true;
      
      // Update badge indicator
      rtlIndicator.classList.remove("visible");
    }
  });
});
