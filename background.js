function getHostname(url) {
  try {
    if (!url || !url.startsWith("http")) return null;
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function getSiteState(domain) {
  if (!domain) return { enabled: false, forceImportant: false };
  const storage = await chrome.storage.local.get(["sitePreferences"]);
  const prefs = storage.sitePreferences || {};

  return prefs[domain] || { enabled: false, forceImportant: false };
}

// دالة تحديث الأيقونة والشارة الذكية (Badge) في شريط المتصفح
function updateTabIconAndBadge(tabId, isEnabled) {
  // 1. تطبيق الشارة الملونة الرسمية (Badge API) - الطريقة الأضمن والأسرع في متصفح كروم
  if (isEnabled) {
    chrome.action.setBadgeText({ text: "ON", tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981", tabId: tabId }); // أخضر ساطع
  } else {
    chrome.action.setBadgeText({ text: "OFF", tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#6b7280", tabId: tabId }); // رمادي مطفأ
  }

  // 2. محاولة تغيير صورة الأيقونة (في حال كانت ملفات الـ PNG موجودة وسليمة 100%)
  const iconPath = isEnabled
    ? {
        16: "icon_active.png",
        48: "icon_active.png",
        128: "icon_active.png",
      }
    : {
        16: "icon_gray.png",
        48: "icon_gray.png",
        128: "icon_gray.png",
      };

  chrome.action.setIcon({ tabId: tabId, path: iconPath }, () => {
    if (chrome.runtime.lastError) {
      // إذا كان هناك أي مشكلة في صور الأيقونة، سيتجاهلها المتصفح وسيعتمد على الشارة الملونة فوق الأيقونة الأساسية
    }
  });
}

async function updateTab(tabId, url) {
  const domain = getHostname(url);
  const state = await getSiteState(domain);

  updateTabIconAndBadge(tabId, state.enabled);

  try {
    await chrome.tabs.sendMessage(tabId, { action: "APPLY_CSS_FIX", ...state });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      setTimeout(
        () =>
          chrome.tabs
            .sendMessage(tabId, { action: "APPLY_CSS_FIX", ...state })
            .catch(() => {}),
        100,
      );
    } catch {}
  }
}

// مراقبة تحميل الصفحات وتحديث الشارة والأيقونة
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) updateTab(tabId, tab.url);
});

// مراقبة التنقل بين تبويبات المتصفح لتحديث لون الشارة حسب الموقع المفتوح
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) updateTab(tab.id, tab.url);
  } catch {}
});

// مراقبة أي تغيير يدوي في الإعدادات من واجهة الإضافة
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url) updateTab(tabs[0].id, tabs[0].url);
  }
});

// مراقبة اختصارات الكيبورد (Ctrl+Shift+E) لتغيير الحالة فوراً
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_site") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url) {
      const domain = getHostname(tabs[0].url);
      if (!domain) return;

      const state = await getSiteState(domain);
      const newState = !state.enabled;

      const storage = await chrome.storage.local.get(["sitePreferences"]);
      const prefs = storage.sitePreferences || {};
      prefs[domain] = {
        enabled: newState,
        forceImportant: state.forceImportant,
      };

      await chrome.storage.local.set({ sitePreferences: prefs });
    }
  }
});
