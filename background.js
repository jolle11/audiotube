const DEFAULTS = {
  audioMode: false,
  autoEnable: false,
  hideThumbnails: false,
  focusMode: false
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set(stored);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-focus-mode") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://www.youtube.com/")) return;

  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FOCUS_MODE" }).catch(() => {});
});
