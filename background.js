function getHostname(url) {
  try {
    if (!url || !url.startsWith("http")) return null;
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "update" && details.reason !== "install") return;

  try {
    const already = await chrome.storage.local.get(["__migratedFromSyncV2"]);
    if (already.__migratedFromSyncV2) return;

    const old = await chrome.storage.sync.get([
      "sitePreferences",
      "globalEnabled",
      "excludePatterns",
    ]);

    const toSet = { __migratedFromSyncV2: true };
    if (old.globalEnabled !== undefined) toSet.globalEnabled = old.globalEnabled;
    if (old.excludePatterns !== undefined) toSet.excludePatterns = old.excludePatterns;
    if (old.sitePreferences) {
      for (const [domain, prefs] of Object.entries(old.sitePreferences)) {
        toSet[`site:${domain}`] = prefs;
      }
    }

    await chrome.storage.local.set(toSet);
    console.log("RTL Fixer: migrated settings from sync to local storage");
  } catch (error) {
    console.error("RTL Fixer: migration from sync storage failed:", error);
  }
});

async function getSiteState(domain) {
  if (!domain) return { enabled: false, forceImportant: false };

  const storage = await chrome.storage.local.get([
    "globalEnabled",
    "excludePatterns",
    `site:${domain}`,
  ]);
  const globalEnabled = storage.globalEnabled || false;
  const excludePatterns = storage.excludePatterns || [];

  if (excludePatterns.length > 0) {
    for (const pattern of excludePatterns) {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(domain)) {
          console.log(`RTL Fixer: Domain ${domain} matches exclude pattern ${pattern}`);
          return { enabled: false, forceImportant: false };
        }
      } catch (error) {
        console.error(`RTL Fixer: Invalid exclude pattern ${pattern}:`, error);
      }
    }
  }

  const siteState = storage[`site:${domain}`] || { enabled: null, forceImportant: false };

  const enabled =
    siteState.enabled !== null && siteState.enabled !== undefined
      ? siteState.enabled
      : globalEnabled;
  const forceImportant = siteState.forceImportant || false;

  return { enabled, forceImportant };
}

function updateTabIconAndBadge(tabId, isEnabled) {
  if (isEnabled) {
    chrome.action.setBadgeText({ text: "ON", tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981", tabId: tabId }); 
  } else {
    chrome.action.setBadgeText({ text: "OFF", tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#6b7280", tabId: tabId }); 
  }

}

async function updateTab(tabId, url) {
  const domain = getHostname(url);
  const state = await getSiteState(domain);

  updateTabIconAndBadge(tabId, state.enabled);

  if (!domain) return;

  try {
    await chrome.tabs.sendMessage(tabId, { action: "APPLY_CSS_FIX", ...state });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      await chrome.tabs
        .sendMessage(tabId, { action: "APPLY_CSS_FIX", ...state })
        .catch((err) => console.warn("RTL Fixer: message still failed after injection", err));
    } catch (err) {
      console.error("RTL Fixer: content script injection failed", err);
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) updateTab(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) updateTab(tab.id, tab.url);
  } catch {}
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;

  const affectsAllTabs = "globalEnabled" in changes || "excludePatterns" in changes;
  const changedSiteKeys = Object.keys(changes).filter((key) => key.startsWith("site:"));

  if (!affectsAllTabs && changedSiteKeys.length === 0) return;

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url) continue;

    if (affectsAllTabs) {
      updateTab(tab.id, tab.url);
      continue;
    }

    const domain = getHostname(tab.url);
    if (domain && changedSiteKeys.includes(`site:${domain}`)) {
      updateTab(tab.id, tab.url);
    }
  }
});

async function showKeyboardFeedback(tabId) {
  try {
    await chrome.action.setBadgeText({ text: "✓", tabId });
    await chrome.action.setBadgeBackgroundColor({ color: "#10b981", tabId });

    setTimeout(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab || !tab.url) return;
        const domain = getHostname(tab.url);
        const state = await getSiteState(domain);
        await chrome.action.setBadgeText({ text: state.enabled ? "ON" : "OFF", tabId });
        await chrome.action.setBadgeBackgroundColor({
          color: state.enabled ? "#10b981" : "#6b7280",
          tabId,
        });
      } catch { }
    }, 2000);
  } catch (error) {
    console.error("RTL Fixer: Could not show keyboard feedback:", error);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle_site") return;

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.url) return;

  const domain = getHostname(tab.url);
  if (!domain) return;

  const state = await getSiteState(domain);
  const newState = !state.enabled;

  try {
    await chrome.storage.local.set({
      [`site:${domain}`]: {
        enabled: newState,
        forceImportant: state.forceImportant,
      },
    });
  } catch (error) {
    console.error("RTL Fixer: failed to save toggle_site change:", error);
    return;
  }

  await updateTab(tab.id, tab.url);
  showKeyboardFeedback(tab.id);
});
