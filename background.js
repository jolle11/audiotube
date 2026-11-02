// Versiones anteriores guardaban channelSpeeds en storage.sync (límite ~8 KB por clave): se migra a local.
chrome.runtime.onInstalled.addListener(async () => {
  const { channelSpeeds } = await chrome.storage.sync.get("channelSpeeds");
  if (!channelSpeeds) return;
  const local = await chrome.storage.local.get({ channelSpeeds: {} });
  await chrome.storage.local.set({ channelSpeeds: { ...channelSpeeds, ...local.channelSpeeds } });
  await chrome.storage.sync.remove("channelSpeeds");
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-focus-mode") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/(www|music)\.youtube\.com\//.test(tab.url || "")) return;

  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FOCUS_MODE" }).catch(() => {});
});
