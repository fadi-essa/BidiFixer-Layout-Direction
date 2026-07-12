document.addEventListener("DOMContentLoaded", async () => {
  const domainNameEl = document.getElementById("domainName");
  const siteEnabled = document.getElementById("siteEnabled");
  const forceImportant = document.getElementById("forceImportant");
  const globalEnabled = document.getElementById("globalEnabled");

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
  } else {
    // صفحة غير مدعومة (مثل إعدادات كروم أو تبويب فارغ)
    domainNameEl.textContent = "Unsupported Page";
    domainNameEl.style.color = "#ef4444";
    siteEnabled.disabled = true;
    forceImportant.disabled = true;
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
});
