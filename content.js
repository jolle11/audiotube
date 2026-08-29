const DEFAULTS = { autoEnable: false, hideThumbnails: false, focusMode: false, smartQuality: true, rememberSpeed: true, skipSeconds: 15, profile: "custom", channelSpeeds: {} };
const PROFILES = {
  music: { audioMode: true, hideThumbnails: false, focusMode: false, smartQuality: true },
  podcast: { audioMode: true, hideThumbnails: true, focusMode: true, smartQuality: true },
  focus: { audioMode: true, hideThumbnails: true, focusMode: true, smartQuality: true },
  sleep: { audioMode: true, hideThumbnails: true, focusMode: true, smartQuality: true }
};
let config = { ...DEFAULTS }, audioMode = false, timer = null, timerTick = null, boundVideo = null, compact = null;
const t = (key) => chrome.i18n.getMessage(key) || key;

const isWatchPage = () => location.pathname === "/watch" || location.pathname.startsWith("/live/");
const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return h ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
};

function injectBridge() {
  if (document.querySelector("script[data-audiotube-bridge]")) return;
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("player-bridge.js");
  script.dataset.audiotubeBridge = "true";
  (document.head || document.documentElement).append(script);
  script.addEventListener("load", () => { script.remove(); requestQuality(); });
}
function requestQuality() {
  document.dispatchEvent(new CustomEvent("audiotube:quality", { detail: { enabled: audioMode && config.smartQuality } }));
}
function applyState() {
  if (config.focusMode && isWatchPage()) {
    audioMode = true;
    sessionStorage.setItem("audiotubeAudioMode", "true");
  }
  const root = document.documentElement;
  root.classList.toggle("audiotube-audio-mode", audioMode && isWatchPage());
  root.classList.toggle("audiotube-hide-thumbnails", config.hideThumbnails);
  root.classList.toggle("audiotube-focus-mode", config.focusMode);
  requestQuality(); ensurePlayer();
}
async function setConfig(patch) {
  config = { ...config, ...patch };
  await chrome.storage.sync.set(patch); applyState(); return getPublicState();
}
function setAudioMode(enabled) {
  audioMode = Boolean(enabled); sessionStorage.setItem("audiotubeAudioMode", String(audioMode)); applyState(); return getPublicState();
}
async function toggleFocusMode() {
  const enabled = !config.focusMode;
  audioMode = enabled;
  sessionStorage.setItem("audiotubeAudioMode", String(enabled));
  return setConfig({ focusMode: enabled, profile: "custom" });
}
async function applyProfile(name) {
  const preset = PROFILES[name]; if (!preset) return getPublicState();
  audioMode = preset.audioMode;
  const { audioMode: ignored, ...settings } = preset;
  config = { ...config, ...settings, profile: name };
  await chrome.storage.sync.set({ ...settings, profile: name });
  sessionStorage.setItem("audiotubeAudioMode", String(audioMode)); applyState();
  if (name === "sleep") startTimer({ mode: "minutes", minutes: 30, fade: true });
  return getPublicState();
}

function createCompactPlayer() {
  const el = document.createElement("div"); el.id = "audiotube-player";
  el.innerHTML = `<div class="at-brand"><span>♫</span><strong>AudioTube</strong><small id="at-title">${t("audioOnly")}</small></div><div class="at-controls"><button data-action="previous" title="${t("previous")}">‹|</button><button data-action="back" title="${t("back")}">−15</button><button class="at-play" data-action="play" title="${t("playPause")}">▶</button><button data-action="forward" title="${t("forward")}">+15</button><button data-action="next" title="${t("next")}">|›</button></div><div class="at-progress"><span id="at-current">0:00</span><input id="at-seek" type="range" min="0" max="1000" value="0"><span id="at-duration">0:00</span></div><div class="at-secondary"><span>${t("volume")}</span><input id="at-volume" type="range" min="0" max="1" step="0.01"><select id="at-rate" aria-label="${t("speed")}"></select></div>`;
  el.addEventListener("click", handleCompactClick);
  el.querySelector("#at-seek").addEventListener("input", (e) => { if (boundVideo?.duration) boundVideo.currentTime = boundVideo.duration * Number(e.target.value) / 1000; });
  el.querySelector("#at-volume").addEventListener("input", (e) => { if (boundVideo) boundVideo.volume = Number(e.target.value); });
  const rate = el.querySelector("#at-rate"); [0.75, 1, 1.25, 1.5, 1.75, 2].forEach((v) => rate.add(new Option(`${v}×`, v)));
  rate.addEventListener("change", (e) => setPlaybackRate(Number(e.target.value))); return el;
}
function handleCompactClick(event) {
  const action = event.target.closest("button")?.dataset.action; if (!action || !boundVideo) return;
  if (action === "play") boundVideo.paused ? boundVideo.play() : boundVideo.pause();
  if (action === "back") boundVideo.currentTime -= Number(config.skipSeconds);
  if (action === "forward") boundVideo.currentTime += Number(config.skipSeconds);
  if (action === "previous") document.querySelector(".ytp-prev-button")?.click();
  if (action === "next") document.querySelector(".ytp-next-button")?.click();
}
function updateCompact() {
  if (!compact || !boundVideo) return;
  compact.querySelector(".at-play").textContent = boundVideo.paused ? "▶" : "❚❚";
  compact.querySelector("#at-current").textContent = formatTime(boundVideo.currentTime);
  compact.querySelector("#at-duration").textContent = formatTime(boundVideo.duration);
  compact.querySelector("#at-seek").value = boundVideo.duration ? boundVideo.currentTime / boundVideo.duration * 1000 : 0;
  compact.querySelector("#at-volume").value = boundVideo.volume; compact.querySelector("#at-rate").value = String(boundVideo.playbackRate);
  compact.querySelector("#at-title").textContent = document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim() || document.title.replace(" - YouTube", "");
  compact.querySelectorAll("[data-action='back'], [data-action='forward']").forEach((b) => { b.textContent = `${b.dataset.action === "back" ? "−" : "+"}${config.skipSeconds}`; });
}
const getChannelKey = () => {
  const link = document.querySelector("ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a");
  return link?.getAttribute("href") || link?.textContent?.trim() || null;
};
async function setPlaybackRate(rate) {
  if (!boundVideo) return; boundVideo.playbackRate = rate;
  const channel = getChannelKey(); if (!config.rememberSpeed || !channel) return;
  config.channelSpeeds = { ...config.channelSpeeds, [channel]: rate }; await chrome.storage.sync.set({ channelSpeeds: config.channelSpeeds });
}
function bindVideo(video) {
  if (video === boundVideo) return; boundVideo = video;
  ["timeupdate", "play", "pause", "volumechange", "ratechange", "durationchange"].forEach((name) => video.addEventListener(name, updateCompact));
  video.addEventListener("ended", handleEnded);
  const remembered = config.channelSpeeds[getChannelKey()]; if (config.rememberSpeed && remembered) video.playbackRate = remembered; updateCompact();
}
function ensurePlayer() {
  const moviePlayer = document.querySelector("#movie_player");
  if (moviePlayer && !document.querySelector("#audiotube-player")) { compact = createCompactPlayer(); moviePlayer.append(compact); }
  else compact = document.querySelector("#audiotube-player");
  const video = document.querySelector("#movie_player video"); if (video) bindVideo(video); updateCompact();
}

function persistTimer() { timer ? sessionStorage.setItem("audiotubeTimer", JSON.stringify(timer)) : sessionStorage.removeItem("audiotubeTimer"); }
function clearTimer(restore = true) {
  clearInterval(timerTick); if (restore && timer?.originalVolume != null && boundVideo) boundVideo.volume = timer.originalVolume;
  timer = null; timerTick = null; persistTimer();
}
function startTimer(options) {
  clearTimer(); if (!options?.mode || options.mode === "off") return null;
  timer = { mode: options.mode, endsAt: options.mode === "minutes" ? Date.now() + Number(options.minutes) * 60000 : null, fade: Boolean(options.fade), originalVolume: boundVideo?.volume ?? 1 };
  persistTimer(); timerTick = setInterval(tickTimer, 1000); tickTimer(); return getTimerStatus();
}
function tickTimer() {
  if (!timer || timer.mode !== "minutes") return; const remaining = timer.endsAt - Date.now();
  if (timer.fade && remaining <= 60000 && boundVideo) boundVideo.volume = Math.max(0, timer.originalVolume * remaining / 60000);
  if (remaining <= 0) { boundVideo?.pause(); clearTimer(false); }
}
function isLastPlaylistItem() {
  const items = [...document.querySelectorAll("ytd-playlist-panel-video-renderer")];
  const selected = items.findIndex((item) => item.hasAttribute("selected") || item.querySelector("#selected"));
  return items.length > 0 && selected === items.length - 1;
}
function handleEnded() {
  if (!timer) return;
  if (timer.mode === "end-video" || (timer.mode === "end-playlist" && isLastPlaylistItem())) {
    document.querySelector(".ytp-autonav-toggle-button[aria-checked='true']")?.click(); boundVideo?.pause(); clearTimer(false);
  }
}
function addTimerMinutes(minutes) {
  if (timer?.mode === "minutes") timer.endsAt += Number(minutes) * 60000; else startTimer({ mode: "minutes", minutes, fade: false });
  persistTimer(); return getTimerStatus();
}
const getTimerStatus = () => timer ? { ...timer, remainingMs: timer.endsAt ? Math.max(0, timer.endsAt - Date.now()) : null } : null;
const getPublicState = () => ({ ...config, audioMode, timer: getTimerStatus(), playbackRate: boundVideo?.playbackRate || 1 });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATE") sendResponse(getPublicState());
  else if (message.type === "SET_CONFIG") {
    if (typeof message.patch.focusMode === "boolean") {
      audioMode = message.patch.focusMode;
      sessionStorage.setItem("audiotubeAudioMode", String(audioMode));
    }
    setConfig({ ...message.patch, profile: "custom" }).then(sendResponse); return true;
  }
  else if (message.type === "SET_AUDIO_MODE") sendResponse(setAudioMode(message.enabled));
  else if (message.type === "TOGGLE_AUDIO_MODE") sendResponse(setAudioMode(!audioMode));
  else if (message.type === "TOGGLE_FOCUS_MODE") { toggleFocusMode().then(sendResponse); return true; }
  else if (message.type === "APPLY_PROFILE") { applyProfile(message.profile).then(sendResponse); return true; }
  else if (message.type === "SET_TIMER") sendResponse(startTimer(message.options));
  else if (message.type === "ADD_TIMER") sendResponse(addTimerMinutes(message.minutes));
  else if (message.type === "SET_RATE") { setPlaybackRate(Number(message.rate)).then(() => sendResponse(getPublicState())); return true; }
  else if (message.type === "SKIP") { if (boundVideo) boundVideo.currentTime += Number(message.seconds); sendResponse(getPublicState()); }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return; Object.entries(changes).forEach(([key, value]) => { config[key] = value.newValue; });
  if (config.focusMode && isWatchPage()) { audioMode = true; sessionStorage.setItem("audiotubeAudioMode", "true"); }
  applyState();
});
document.addEventListener("yt-navigate-finish", () => {
  if (config.autoEnable && isWatchPage()) audioMode = true; setTimeout(ensurePlayer, 300);
  setTimeout(() => { const speed = config.channelSpeeds[getChannelKey()]; if (config.rememberSpeed && speed && boundVideo) boundVideo.playbackRate = speed; updateCompact(); }, 1200); applyState();
});
async function initialize() {
  injectBridge(); config = await chrome.storage.sync.get(DEFAULTS);
  const savedMode = sessionStorage.getItem("audiotubeAudioMode"); audioMode = savedMode === null ? config.autoEnable && isWatchPage() : savedMode === "true";
  if (config.focusMode && isWatchPage()) audioMode = true;
  try { const saved = JSON.parse(sessionStorage.getItem("audiotubeTimer")); if (saved && (!saved.endsAt || saved.endsAt > Date.now())) { timer = saved; timerTick = setInterval(tickTimer, 1000); } } catch { sessionStorage.removeItem("audiotubeTimer"); }
  applyState(); setInterval(ensurePlayer, 1000);
}
initialize();
