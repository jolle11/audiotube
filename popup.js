const configIds = ["autoEnable", "smartQuality", "rememberSpeed", "hideThumbnails", "focusMode"];
let tabId = null, poll = null;
const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;
async function send(message) { return chrome.tabs.sendMessage(tabId, message); }
function localizePage() {
  document.documentElement.lang = chrome.i18n.getUILanguage().split("-")[0];
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
}
async function renderShortcut() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  const isMac = /mac/i.test(platform);
  const commands = await chrome.commands.getAll();
  const assigned = commands.find((command) => command.name === "toggle-focus-mode")?.shortcut;
  const fallback = isMac ? "Command+Shift+A" : "Ctrl+Shift+Y";
  const rawShortcut = assigned || fallback;
  const keys = isMac
    ? ["⌘", "⇧", "A"]
    : rawShortcut.split("+").map((key) => key === "Command" ? "⌘" : key);
  document.querySelector("#shortcut").innerHTML = keys
    .map((key) => `<kbd>${key}</kbd>`)
    .join('<span class="shortcut-plus">+</span>');
}
function displayTimer(timer) {
  const status = document.querySelector("#timerStatus"), add = document.querySelector("#addTime"); add.hidden = timer?.mode !== "minutes";
  if (!timer) { status.textContent = t("noTimer"); return; }
  if (timer.mode === "minutes") { const s = Math.ceil(timer.remainingMs / 1000); status.textContent = t("timeRemaining", `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`); }
  if (timer.mode === "end-video") status.textContent = t("stopsAfterVideo");
  if (timer.mode === "end-playlist") status.textContent = t("stopsAfterPlaylist");
}
function render(state) {
  document.querySelector("#audioMode").checked = state.audioMode; document.querySelector("#profile").value = state.profile;
  configIds.forEach((id) => { document.getElementById(id).checked = Boolean(state[id]); });
  document.querySelector("#skipSeconds").value = String(state.skipSeconds);
  document.querySelector("#back").textContent = `−${state.skipSeconds}`; document.querySelector("#forward").textContent = `+${state.skipSeconds}`;
  const rate = document.querySelector("#rate"); [...rate.options].forEach((option) => { option.value = option.textContent.replace("×", ""); }); rate.value = String(state.playbackRate);
  displayTimer(state.timer);
}
async function initialize() {
  localizePage();
  renderShortcut();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith("https://www.youtube.com/")) { document.querySelector("#notice").hidden = false; document.querySelector("#controls").classList.add("disabled"); return; }
  tabId = tab.id;
  try { render(await send({ type: "GET_STATE" })); } catch { document.querySelector("#notice").hidden = false; document.querySelector("#notice").textContent = t("reloadNotice"); document.querySelector("#controls").classList.add("disabled"); return; }
  document.querySelector("#audioMode").addEventListener("change", async (e) => render(await send({ type: "SET_AUDIO_MODE", enabled: e.target.checked })));
  document.querySelector("#profile").addEventListener("change", async (e) => render(await send({ type: "APPLY_PROFILE", profile: e.target.value })));
  configIds.forEach((id) => document.getElementById(id).addEventListener("change", async (e) => render(await send({ type: "SET_CONFIG", patch: { [id]: e.target.checked } }))));
  document.querySelector("#skipSeconds").addEventListener("change", async (e) => render(await send({ type: "SET_CONFIG", patch: { skipSeconds: Number(e.target.value) } })));
  document.querySelector("#rate").addEventListener("change", (e) => send({ type: "SET_RATE", rate: Number(e.target.value) }));
  document.querySelector("#back").addEventListener("click", () => send({ type: "SKIP", seconds: -Number(document.querySelector("#skipSeconds").value) }));
  document.querySelector("#forward").addEventListener("click", () => send({ type: "SKIP", seconds: Number(document.querySelector("#skipSeconds").value) }));
  document.querySelector("#timer").addEventListener("change", async (e) => { const value = e.target.value; const options = /^\d+$/.test(value) ? { mode: "minutes", minutes: Number(value), fade: document.querySelector("#fade").checked } : { mode: value, fade: false }; displayTimer(await send({ type: "SET_TIMER", options })); });
  document.querySelector("#addTime").addEventListener("click", async () => displayTimer(await send({ type: "ADD_TIMER", minutes: 10 })));
  poll = setInterval(async () => { try { displayTimer((await send({ type: "GET_STATE" })).timer); } catch { clearInterval(poll); } }, 1000);
}
initialize();
