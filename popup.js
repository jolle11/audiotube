const U = AudioTubeUtil;
const configIds = ["autoEnable", "smartQuality", "rememberSpeed", "resumePosition", "hideThumbnails", "focusMode"];
const $ = (selector) => document.querySelector(selector);
let tabId = null, poll = null;
const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;
async function send(message) { return chrome.tabs.sendMessage(tabId, message); }

function localizePage() {
  document.documentElement.lang = chrome.i18n.getUILanguage().split("-")[0];
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
}

async function renderShortcut() {
  const commands = await chrome.commands.getAll();
  const assigned = commands.find((command) => command.name === "toggle-focus-mode")?.shortcut;
  const shortcut = $("#shortcut");
  if (!assigned) {
    // Chrome solo aplica el atajo sugerido al instalar y lo omite si choca con otro: se ofrece asignarlo.
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = t("shortcutUnassigned");
    link.addEventListener("click", (event) => { event.preventDefault(); chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); });
    shortcut.replaceChildren(link);
    return;
  }
  const keys = assigned.split("+").map((key) => ({ Command: "⌘", Shift: "⇧", Option: "⌥", MacCtrl: "⌃" })[key] || key);
  shortcut.innerHTML = keys
    .map((key) => `<kbd>${key}</kbd>`)
    .join('<span class="shortcut-plus">+</span>');
}

function renderTimer(timer) {
  const status = $("#timerStatus");
  $("#addTime").hidden = timer?.mode !== "minutes";
  if (!timer) status.textContent = t("noTimer");
  else if (timer.mode === "minutes") status.textContent = t("timeRemaining", U.formatRemaining(timer.remainingMs));
  else status.textContent = t(timer.mode === "end-video" ? "stopsAfterVideo" : "stopsAfterPlaylist");
  // Al reabrir el popup, el selector y el fundido reflejan el temporizador en marcha.
  if (document.activeElement !== $("#timer")) $("#timer").value = !timer ? "off" : timer.mode === "minutes" ? String(timer.minutes) : timer.mode;
  if (timer) $("#fade").checked = timer.fade;
}

function renderRate(rate) {
  const select = $("#rate");
  if (document.activeElement === select) return;
  select.replaceChildren(...U.rateOptions(rate).map(U.rateValue).map((value) => new Option(`${value.replace(/^0\./, ".")}×`, value)));
  select.value = U.rateValue(rate);
}

// Pinta el estado completo que devuelve la pestaña: modos, preferencias, velocidad, salto, canal y temporizador.
function render(state) {
  $("#audioMode").checked = state.audioMode;
  $("#profile").value = state.profile;
  configIds.forEach((id) => { document.getElementById(id).checked = Boolean(state[id]); });
  $("#skipSeconds").value = String(state.skipSeconds);
  $("#back").textContent = `−${state.skipSeconds}`;
  $("#forward").textContent = `+${state.skipSeconds}`;
  $("#channelRuleRow").classList.toggle("unavailable", !state.channel);
  $("#channelRule").checked = Boolean(state.channel?.rule);
  $("#channelName").textContent = state.channel?.name || t("channelUnknown");
  renderRate(state.playbackRate);
  renderTimer(state.timer);
}

function disable(noticeKey) {
  $("#notice").hidden = false;
  $("#notice").textContent = t(noticeKey);
  $("#controls").classList.add("disabled");
}

const on = (selector, event, handler) => $(selector).addEventListener(event, async (e) => render(await send(handler(e))));

async function initialize() {
  localizePage();
  renderShortcut();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!U.isYouTubeUrl(tab?.url)) return disable("youtubeNotice");
  tabId = tab.id;
  try { render(await send({ type: "GET_STATE" })); } catch { return disable("reloadNotice"); }
  on("#audioMode", "change", (e) => ({ type: "SET_AUDIO_MODE", enabled: e.target.checked }));
  on("#profile", "change", (e) => ({ type: "APPLY_PROFILE", profile: e.target.value }));
  configIds.forEach((id) => on(`#${id}`, "change", (e) => ({ type: "SET_CONFIG", patch: { [id]: e.target.checked } })));
  on("#skipSeconds", "change", (e) => ({ type: "SET_CONFIG", patch: { skipSeconds: Number(e.target.value) } }));
  on("#channelRule", "change", (e) => ({ type: "SET_CHANNEL_RULE", enabled: e.target.checked }));
  on("#rate", "change", (e) => ({ type: "SET_RATE", rate: Number(e.target.value) }));
  on("#back", "click", () => ({ type: "SKIP", seconds: -Number($("#skipSeconds").value) }));
  on("#forward", "click", () => ({ type: "SKIP", seconds: Number($("#skipSeconds").value) }));
  on("#timer", "change", (e) => {
    const value = e.target.value;
    return { type: "SET_TIMER", options: /^\d+$/.test(value) ? { mode: "minutes", minutes: Number(value), fade: $("#fade").checked } : { mode: value } };
  });
  on("#addTime", "click", () => ({ type: "ADD_TIMER", minutes: 10 }));
  poll = setInterval(async () => {
    try {
      const state = await send({ type: "GET_STATE" });
      renderTimer(state.timer);
      renderRate(state.playbackRate);
    } catch { clearInterval(poll); }
  }, 1000);
}
initialize();
