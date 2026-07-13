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
  const storage = await chrome.storage.sync.get(["sitePreferences", "globalEnabled", "excludePatterns"]);
  const prefs = storage.sitePreferences || {};
  const globalEnabled = storage.globalEnabled || false;
  const excludePatterns = storage.excludePatterns || [];
  
  // Check if domain matches any exclude pattern
  if (excludePatterns.length > 0) {
    for (const pattern of excludePatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(domain)) {
          console.log(`RTL Fixer: Domain ${domain} matches exclude pattern ${pattern}`);
          return { enabled: false, forceImportant: false };
        }
      } catch (error) {
        console.error(`RTL Fixer: Invalid exclude pattern ${pattern}:`, error);
      }
    }
  }
  
  // Check site-specific settings first, then fall back to global
  const siteState = prefs[domain] || { enabled: null, forceImportant: false };
  
  // If site has explicit setting, use it; otherwise use global
  const enabled = siteState.enabled !== null ? siteState.enabled : globalEnabled;
  const forceImportant = siteState.forceImportant;
  
  return { enabled, forceImportant };
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

  // Note: Icon image switching removed - missing icon_active.png/icon_gray.png files
  // Badge text and color provide clear visual feedback instead
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
  if (area === "sync") {
    // Update all tabs when global settings change
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url) updateTab(tab.id, tab.url);
    }
  }
});

// Cleanup: Reset badge when tab is closed to prevent stale state
chrome.tabs.onRemoved.addListener((tabId) => {
  // Chrome automatically cleans up badge for closed tabs, but we log for debugging
  console.log(`RTL Fixer: Tab ${tabId} closed`);
});

// Helper function to show keyboard feedback notification
async function showKeyboardFeedback(message, duration = 2000) {
  try {
    // Create a temporary notification badge on the extension icon
    await chrome.action.setBadgeText({ text: "✓" });
    await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    
    setTimeout(async () => {
      // Restore normal badge based on current tab state
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const domain = getHostname(tab.url);
        const state = await getSiteState(domain);
        await chrome.action.setBadgeText({ text: state.enabled ? "ON" : "OFF", tabId: tab.id });
        await chrome.action.setBadgeBackgroundColor({ 
          color: state.enabled ? "#10b981" : "#6b7280", 
          tabId: tab.id 
        });
      }
    }, duration);
  } catch (error) {
    console.error("RTL Fixer: Could not show keyboard feedback:", error);
  }
}

// مراقبة اختصارات الكيبورد (Ctrl+Shift+E) لتغيير الحالة فوراً
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_site") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url) {
      const domain = getHostname(tabs[0].url);
      if (!domain) return;

      const state = await getSiteState(domain);
      const newState = !state.enabled;

      const storage = await chrome.storage.sync.get(["sitePreferences"]);
      const prefs = storage.sitePreferences || {};
      prefs[domain] = {
        enabled: newState,
        forceImportant: state.forceImportant,
      };

      await chrome.storage.sync.set({ sitePreferences: prefs });
      
      // Show keyboard feedback notification
      showKeyboardFeedback(newState ? "RTL Enabled" : "RTL Disabled");
    }
  }
});
