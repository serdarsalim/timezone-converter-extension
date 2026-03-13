const STORAGE_KEY = "timesStateV1";

async function getStoredPreferences() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result?.[STORAGE_KEY]?.preferences || {};
}

async function applyLaunchSurface(preferences = {}) {
  const openInSidePanel = preferences.openInSidePanel === true;

  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: openInSidePanel
  });

  await chrome.action.setPopup({
    popup: openInSidePanel ? "" : "popup.html?surface=popup"
  });
}

async function syncLaunchSurface() {
  try {
    const preferences = await getStoredPreferences();
    await applyLaunchSurface(preferences);
  } catch (error) {
    console.error("Failed to sync launch surface", error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void syncLaunchSurface();
});

chrome.runtime.onStartup.addListener(() => {
  void syncLaunchSurface();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "times:preferences-updated") {
    void syncLaunchSurface();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[STORAGE_KEY]) {
    return;
  }
  void syncLaunchSurface();
});

void syncLaunchSurface();
