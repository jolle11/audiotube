"use strict";

// Temporizador de sueño: por minutos (con fundido opcional), al terminar el vídeo o la lista.
const AudioTubeTimer = (() => {
  const U = AudioTubeUtil;
  const TIMER_KEY = "audiotubeTimer";
  const AUTOPLAY_KEY = "audiotubeRestoreAutoplay";
  let timer = null, tick = null;
  let hooks = { video: () => null, update: () => {} };

  const persist = () => timer ? sessionStorage.setItem(TIMER_KEY, JSON.stringify(timer)) : sessionStorage.removeItem(TIMER_KEY);

  function restoreVolume() {
    const video = hooks.video();
    if (timer?.faded && video) video.volume = timer.originalVolume;
    if (timer) timer.faded = false;
  }

  function clear() {
    clearInterval(tick);
    restoreVolume();
    timer = null; tick = null;
    persist(); hooks.update();
  }

  function schedule() {
    clearInterval(tick);
    tick = timer?.mode === "minutes" ? setInterval(step, 1000) : null;
    if (tick) step();
  }

  function start(options) {
    clear();
    if (!options?.mode || options.mode === "off") return status();
    const minutes = Number(options.minutes);
    timer = {
      mode: options.mode,
      minutes: options.mode === "minutes" ? minutes : null,
      endsAt: options.mode === "minutes" ? Date.now() + minutes * 60000 : null,
      fade: options.mode === "minutes" && Boolean(options.fade),
      originalVolume: hooks.video()?.volume ?? 1,
      faded: false
    };
    persist(); schedule(); hooks.update();
    return status();
  }

  function step() {
    if (timer?.mode !== "minutes") return;
    const remaining = timer.endsAt - Date.now(), video = hooks.video();
    if (timer.fade && video) {
      if (remaining < U.FADE_WINDOW_MS) { video.volume = U.fadedVolume(timer.originalVolume, remaining); timer.faded = true; }
      else if (timer.faded) restoreVolume();
    }
    if (remaining <= 0) { video?.pause(); clear(); return; }
    hooks.update();
  }

  function addMinutes(minutes) {
    if (timer?.mode !== "minutes") return start({ mode: "minutes", minutes, fade: false });
    timer.endsAt += Number(minutes) * 60000;
    step(); persist();
    return status();
  }

  function isLastPlaylistItem() {
    const items = [...document.querySelectorAll("ytd-playlist-panel-renderer:not([hidden]) ytd-playlist-panel-video-renderer")];
    const selected = items.findIndex((item) => item.hasAttribute("selected"));
    return selected !== -1 && selected === items.length - 1;
  }

  function handleEnded() {
    if (!timer || timer.mode === "minutes") return;
    if (timer.mode === "end-playlist" && !isLastPlaylistItem()) return;
    // Se desactiva la reproducción automática para que no empiece otro vídeo, y se recuerda
    // para volver a activarla la próxima vez que el usuario reproduzca algo.
    const autoplay = document.querySelector(".ytp-autonav-toggle-button[aria-checked='true']");
    if (autoplay) { autoplay.click(); sessionStorage.setItem(AUTOPLAY_KEY, "true"); }
    hooks.video()?.pause();
    clear();
  }

  function handlePlay() {
    if (sessionStorage.getItem(AUTOPLAY_KEY) !== "true" || timer) return;
    sessionStorage.removeItem(AUTOPLAY_KEY);
    document.querySelector(".ytp-autonav-toggle-button[aria-checked='false']")?.click();
  }

  function status() {
    if (!timer) return null;
    return { mode: timer.mode, minutes: timer.minutes, fade: timer.fade, remainingMs: timer.endsAt ? Math.max(0, timer.endsAt - Date.now()) : null };
  }

  function init(nextHooks) {
    hooks = nextHooks;
    try {
      const saved = JSON.parse(sessionStorage.getItem(TIMER_KEY));
      if (saved && (!saved.endsAt || saved.endsAt > Date.now())) { timer = saved; schedule(); }
      else sessionStorage.removeItem(TIMER_KEY);
    } catch { sessionStorage.removeItem(TIMER_KEY); }
  }

  return { init, start, clear, addMinutes, status, handleEnded, handlePlay };
})();
