document.addEventListener("DOMContentLoaded", async () => {
  const domainNameEl = document.getElementById("domainName");
  const siteEnabled = document.getElementById("siteEnabled");
  const forceImportant = document.getElementById("forceImportant");

  // 1. قراءة إعدادات المواقع المحفوظة
  const storage = await chrome.storage.local.get(["sitePreferences"]);
  const prefs = storage.sitePreferences || {};

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
      enabled: false,
      forceImportant: false,
    };
    siteEnabled.checked = siteSettings.enabled;
    forceImportant.checked = siteSettings.forceImportant;
    forceImportant.disabled = !siteSettings.enabled;
  } else {
    // صفحة غير مدعومة (مثل إعدادات كروم أو تبويب فارغ)
    domainNameEl.textContent = "Unsupported Page";
    domainNameEl.style.color = "#ef4444";
    siteEnabled.disabled = true;
    forceImportant.disabled = true;
  }

  // 3. دالة الحفظ للموقع الحالي
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
  }

  siteEnabled.addEventListener("change", saveSiteSettings);
  forceImportant.addEventListener("change", saveSiteSettings);
});
