"use strict";

// Vídeo enlazado, reproductor compacto, Media Session y posición guardada.
const AudioTubePlayer = (() => {
  const U = AudioTubeUtil;
  const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;
  const VIDEO_SELECTORS = {
    watch: "#movie_player video",
    music: "#movie_player video",
    shorts: "ytd-reel-video-renderer[is-active] video, #shorts-player video"
  };
  const SAVE_INTERVAL_MS = 5000;
  // Mismo dibujo que icons/icon.svg (auriculares + reproducir), sin el fondo, que pone el CSS.
  const LOGO = `<svg viewBox="0 0 128 128" aria-hidden="true"><path d="M30 76V64a34 34 0 0 1 68 0v12" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><rect x="22" y="68" width="22" height="34" rx="9" fill="#fff"/><rect x="84" y="68" width="22" height="34" rx="9" fill="#fff"/><path d="M56 70v24l20-12z" fill="#fff"/></svg>`;

  let video = null, videoEvents = null, compact = null, refs = null, seeking = false, lastSave = 0, resumedFor = null;
  let hooks = { site: () => "browse", context: () => ({}), audioActive: () => false, onVideoLoaded: () => {}, onRateChange: () => {}, addTime: () => {} };

  const config = () => AudioTubeState.state.config;

  // Datos del vídeo actual. En /watch solo se lee el canal si la página ya pertenece al vídeo de la URL.
  function readMetadata(videoId) {
    const site = hooks.site();
    let link = null, title = null;
    if (site === "watch") {
      const flexy = document.querySelector("ytd-watch-flexy");
      if (!flexy || flexy.getAttribute("video-id") !== videoId) return null;
      link = flexy.querySelector("ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a");
      title = flexy.querySelector("ytd-watch-metadata h1 yt-formatted-string")?.textContent;
    } else if (site === "shorts") {
      const reel = document.querySelector("ytd-reel-video-renderer[is-active]");
      link = reel?.querySelector("ytd-channel-name a, .ytReelChannelBarViewModelChannelName a, a[href^='/@']");
      title = reel?.querySelector("h2, .ytShortsVideoTitleViewModelShortsVideoTitle")?.textContent;
    } else if (site === "music") {
      const bar = document.querySelector("ytmusic-player-bar");
      link = bar?.querySelector(".byline a");
      title = bar?.querySelector(".title")?.textContent;
    }
    const name = link?.textContent?.trim();
    const key = link?.getAttribute("href")?.split("?")[0] || name;
    return key ? { key, name: name || key, title: title?.trim() || null } : null;
  }

  function currentTitle() {
    return hooks.context().meta?.title || document.title.replace(/ - YouTube( Music)?$/, "");
  }

  function fillRateSelect(select, current) {
    const value = U.rateValue(current);
    const options = U.rateOptions(current).map(U.rateValue);
    if ([...select.options].map((option) => option.value).join() !== options.join()) {
      select.replaceChildren(...options.map((rate) => new Option(`${rate.replace(/^0\./, ".")}×`, rate)));
    }
    select.value = value;
  }

  function createCompactPlayer() {
    const el = document.createElement("div");
    el.id = "audiotube-player";
    el.innerHTML = `<div class="at-brand"><span>${LOGO}</span><strong>AudioTube</strong><small data-ref="title"></small></div>
      <div class="at-controls"><button data-action="previous" title="${t("previous")}">‹|</button><button data-action="back" title="${t("back")}"></button><button class="at-play" data-action="play" title="${t("playPause")}">▶</button><button data-action="forward" title="${t("forward")}"></button><button data-action="next" title="${t("next")}">|›</button></div>
      <div class="at-progress"><span data-ref="current">0:00</span><input data-ref="seek" type="range" min="0" max="1000" value="0"><span data-ref="duration">0:00</span></div>
      <div class="at-secondary"><span>${t("volume")}</span><input data-ref="volume" type="range" min="0" max="1" step="0.01"><select data-ref="rate" aria-label="${t("speed")}"></select></div>
      <div class="at-timer" data-ref="timer" hidden><span data-ref="timerLabel"></span><button data-action="add-time">${t("addTen")}</button></div>`;
    refs = Object.fromEntries([...el.querySelectorAll("[data-ref]")].map((node) => [node.dataset.ref, node]));
    refs.play = el.querySelector(".at-play");
    refs.back = el.querySelector("[data-action='back']");
    refs.forward = el.querySelector("[data-action='forward']");
    el.addEventListener("click", handleCompactClick);
    refs.seek.addEventListener("pointerdown", () => { seeking = true; });
    refs.seek.addEventListener("input", (e) => { seeking = true; refs.current.textContent = U.formatTime(video?.duration * Number(e.target.value) / 1000); });
    refs.seek.addEventListener("change", (e) => {
      if (video?.duration) video.currentTime = video.duration * Number(e.target.value) / 1000;
      seeking = false;
    });
    refs.volume.addEventListener("input", (e) => { if (video) video.volume = Number(e.target.value); });
    refs.rate.addEventListener("change", (e) => hooks.onRateChange(Number(e.target.value)));
    return el;
  }

  function handleCompactClick(event) {
    const action = event.target.closest("button")?.dataset.action;
    if (!action) return;
    if (action === "add-time") return hooks.addTime();
    if (!video) return;
    if (action === "play") video.paused ? video.play() : video.pause();
    if (action === "back") skip(-config().skipSeconds);
    if (action === "forward") skip(config().skipSeconds);
    if (action === "previous") document.querySelector(".ytp-prev-button")?.click();
    if (action === "next") document.querySelector(".ytp-next-button")?.click();
  }

  function skip(seconds) { if (video) video.currentTime = Math.max(0, video.currentTime + Number(seconds)); }

  function update() {
    if (!compact || !refs || !video) return;
    refs.play.textContent = video.paused ? "▶" : "❚❚";
    if (!seeking) {
      refs.current.textContent = U.formatTime(video.currentTime);
      refs.seek.value = video.duration ? video.currentTime / video.duration * 1000 : 0;
    }
    refs.duration.textContent = U.formatTime(video.duration);
    refs.volume.value = video.volume;
    if (document.activeElement !== refs.rate) fillRateSelect(refs.rate, video.playbackRate);
    refs.title.textContent = currentTitle();
    refs.back.textContent = `−${config().skipSeconds}`;
    refs.forward.textContent = `+${config().skipSeconds}`;
  }

  function renderTimer(status) {
    if (!refs) return;
    refs.timer.hidden = !status;
    if (!status) return;
    refs.timerLabel.textContent = status.mode === "minutes" ? t("timeRemaining", U.formatRemaining(status.remainingMs))
      : t(status.mode === "end-video" ? "stopsAfterVideo" : "stopsAfterPlaylist");
    refs.timer.querySelector("button").hidden = status.mode !== "minutes";
  }

  function savePosition() {
    const { videoId } = hooks.context();
    if (!config().resumePosition || !videoId || !video || video.duration < U.RESUME_MIN_DURATION) return;
    const now = Date.now();
    if (now - lastSave < SAVE_INTERVAL_MS) return;
    lastSave = now;
    AudioTubeState.remember("positions", videoId, Math.floor(video.currentTime));
  }

  function maybeResume(videoId) {
    // Solo una vez por vídeo, y no con anuncios (duración corta) ni si la URL ya fija un instante.
    if (!config().resumePosition || !video || !videoId || resumedFor === videoId || video.duration < U.RESUME_MIN_DURATION) return;
    resumedFor = videoId;
    if (new URLSearchParams(location.search).has("t")) return;
    const saved = AudioTubeState.state.local.positions[videoId];
    if (U.shouldResume(saved, video.duration)) video.currentTime = saved;
  }

  function forgetPosition() {
    const { videoId } = hooks.context();
    if (videoId && AudioTubeState.state.local.positions[videoId] !== undefined) AudioTubeState.remember("positions", videoId, undefined);
  }

  function updateMediaSession() {
    if (!("mediaSession" in navigator) || !video || !hooks.audioActive()) return;
    const { videoId, meta } = hooks.context();
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTitle(),
      artist: meta?.name || "",
      album: "AudioTube",
      artwork: videoId ? [{ src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, sizes: "480x360", type: "image/jpeg" }] : []
    });
    const handlers = {
      play: () => video?.play(),
      pause: () => video?.pause(),
      seekbackward: (details) => skip(-(details.seekOffset || config().skipSeconds)),
      seekforward: (details) => skip(details.seekOffset || config().skipSeconds),
      seekto: (details) => { if (video && Number.isFinite(details.seekTime)) video.currentTime = details.seekTime; },
      previoustrack: () => document.querySelector(".ytp-prev-button")?.click(),
      nexttrack: () => document.querySelector(".ytp-next-button")?.click()
    };
    Object.entries(handlers).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Acción no soportada por el navegador. */ }
    });
  }

  function bind(next) {
    if (next === video) return;
    videoEvents?.abort();
    video = next;
    videoEvents = new AbortController();
    const { signal } = videoEvents;
    ["play", "pause", "volumechange", "ratechange", "durationchange"].forEach((name) => video.addEventListener(name, update, { signal }));
    video.addEventListener("timeupdate", () => { update(); savePosition(); }, { signal });
    video.addEventListener("loadedmetadata", () => hooks.onVideoLoaded(), { signal });
    video.addEventListener("play", () => { AudioTubeTimer.handlePlay(); updateMediaSession(); }, { signal });
    video.addEventListener("ended", () => { forgetPosition(); AudioTubeTimer.handleEnded(); }, { signal });
    if (video.readyState >= 1) hooks.onVideoLoaded();
    update();
  }

  // Crea el reproductor compacto si falta y enlaza el <video> visible. Idempotente y barato.
  function ensure() {
    const site = hooks.site();
    if (site === "watch" || site === "music") {
      const moviePlayer = document.querySelector("#movie_player");
      if (moviePlayer) {
        // Si la extensión se recargó, el reproductor anterior ya no tiene listeners: se sustituye.
        if (!compact) { document.querySelector("#audiotube-player")?.remove(); compact = createCompactPlayer(); }
        if (!moviePlayer.contains(compact)) moviePlayer.append(compact);
      }
    }
    const selector = VIDEO_SELECTORS[site];
    const next = selector && document.querySelector(selector);
    if (next) bind(next);
    update();
  }

  // Qué piezas de la página de YouTube se han encontrado, para avisar si algún selector deja de funcionar.
  function health() {
    const site = hooks.site();
    return {
      video: { ok: Boolean(video?.isConnected), selector: VIDEO_SELECTORS[site] },
      player: { ok: site === "shorts" || Boolean(compact?.isConnected), selector: "#movie_player" }
    };
  }

  function setRate(rate) { if (video) video.playbackRate = rate; }

  function init(nextHooks) { hooks = nextHooks; }

  return { init, ensure, health, update, renderTimer, readMetadata, maybeResume, updateMediaSession, setRate, skip, fillRateSelect, get video() { return video; } };
})();
