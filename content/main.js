"use strict";

// Orquestación: modos solo audio / concentración, contexto del vídeo, mensajes y navegación.
(() => {
  const U = AudioTubeUtil, S = AudioTubeState, T = AudioTubeTimer, P = AudioTubePlayer;
  const { state } = S;
  const META_RETRY_MS = 500, META_RETRIES = 10, HEALTH_CHECK_MS = 6000;
  const META_SELECTORS = { watch: "ytd-watch-flexy[video-id] ytd-channel-name a", shorts: "ytd-reel-video-renderer[is-active] ytd-channel-name a", music: "ytmusic-player-bar .byline a" };

  // Vídeo actual y sus metadatos verificados (canal, título). meta es null hasta que la página coincide con la URL.
  let context = { videoId: null, meta: null };
  let metaRetry = null, metaAttempts = 0, healthCheck = null;
  const warned = new Set();
  let qualityRequest = { enabled: false, videoId: null };

  const site = () => U.detectSite(location);
  const channelRule = () => Boolean(context.meta && state.local.channelRules[context.meta.key]);

  // Única fuente de verdad del modo solo audio:
  // concentración (en /watch) > elección del usuario en la pestaña > activación automática o regla del canal.
  function audioActive() {
    const current = site();
    if (current === "browse") return false;
    if (state.config.focusMode && current === "watch") return true;
    if (state.userAudio !== null) return state.userAudio;
    return state.config.autoEnable || channelRule();
  }

  function injectBridge() {
    if (document.querySelector("script[data-audiotube-bridge]")) return;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("player-bridge.js");
    script.dataset.audiotubeBridge = "true";
    script.addEventListener("load", () => { script.remove(); qualityRequest = { enabled: false, videoId: null }; requestQuality(); });
    (document.head || document.documentElement).append(script);
  }

  // Solo se avisa al reproductor cuando cambia algo, para no pisar la calidad elegida por el usuario.
  function requestQuality() {
    const enabled = audioActive() && state.config.smartQuality && site() !== "shorts";
    const changed = enabled ? !qualityRequest.enabled || qualityRequest.videoId !== context.videoId : qualityRequest.enabled;
    if (!changed) return;
    qualityRequest = { enabled, videoId: context.videoId };
    document.dispatchEvent(new CustomEvent("audiotube:quality", { detail: { enabled } }));
  }

  function applyState() {
    const current = site(), root = document.documentElement, audio = audioActive();
    root.classList.toggle("audiotube-audio-mode", audio);
    root.classList.toggle("audiotube-shorts", current === "shorts");
    root.classList.toggle("audiotube-hide-thumbnails", state.config.hideThumbnails && current !== "music");
    root.classList.toggle("audiotube-focus-mode", state.config.focusMode && current === "watch");
    requestQuality();
    P.ensure();
    P.updateMediaSession();
  }

  function refreshContext() {
    const videoId = U.videoIdFrom(location);
    if (videoId !== context.videoId) {
      context = { videoId, meta: null };
      metaAttempts = 0;
      clearTimeout(healthCheck);
      if (videoId) healthCheck = setTimeout(checkSelectors, HEALTH_CHECK_MS);
    }
    if (!context.meta && videoId) {
      const meta = P.readMetadata(videoId);
      if (meta) onMetadata(meta);
      else if (metaAttempts++ < META_RETRIES) { clearTimeout(metaRetry); metaRetry = setTimeout(refreshContext, META_RETRY_MS); }
    }
    applyState();
  }

  // Avisa una sola vez por tipo si, pasado un tiempo, falta alguna pieza de la página de YouTube.
  function checkSelectors() {
    const current = site();
    if (current === "browse") return;
    const parts = { ...P.health(), channel: { ok: Boolean(context.meta), selector: META_SELECTORS[current] } };
    Object.entries(parts).forEach(([name, { ok, selector }]) => {
      const key = `${current}:${name}`;
      if (ok || warned.has(key)) return;
      warned.add(key);
      console.warn(`AudioTube: no se encuentra «${name}» en ${current} (${selector}). Puede que YouTube haya cambiado su página.`);
    });
  }

  function onMetadata(meta) {
    context.meta = meta;
    applyChannelSpeed();
  }

  function applyChannelSpeed() {
    const speed = context.meta && state.local.channelSpeeds[context.meta.key];
    if (state.config.rememberSpeed && speed) P.setRate(speed);
  }

  function onVideoLoaded() {
    refreshContext();
    // YouTube restablece la velocidad al cargar cada vídeo; se vuelve a aplicar la del canal.
    applyChannelSpeed();
    P.maybeResume(context.videoId);
  }

  async function setPlaybackRate(rate) {
    if (!Number.isFinite(rate) || rate <= 0) return;
    P.setRate(rate);
    // Solo se guarda con un canal verificado para este vídeo, nunca con el del vídeo anterior.
    if (state.config.rememberSpeed && context.meta) await S.remember("channelSpeeds", context.meta.key, rate);
  }

  function setAudioMode(enabled) {
    S.setUserAudio(Boolean(enabled));
    // Apagar el solo audio con la concentración activa apaga también la concentración, que lo fuerza.
    if (!enabled && state.config.focusMode && site() === "watch") return setConfig({ focusMode: false });
    applyState();
    return Promise.resolve();
  }

  async function setConfig(patch) {
    await S.setConfig({ ...patch, profile: "custom" });
    applyState();
  }

  async function applyProfile(name) {
    const preset = S.PROFILES[name];
    if (!preset) return;
    S.setUserAudio(preset.audio);
    await S.setConfig({ ...preset.config, profile: name });
    applyState();
    if (preset.timer) T.start(preset.timer);
  }

  async function setChannelRule(enabled) {
    if (!context.meta) return;
    await S.remember("channelRules", context.meta.key, enabled ? "audio" : undefined);
    if (enabled) S.setUserAudio(null);
    applyState();
  }

  function publicState() {
    return {
      ...state.config,
      site: site(),
      audioMode: audioActive(),
      timer: T.status(),
      playbackRate: P.video?.playbackRate || 1,
      channel: context.meta ? { name: context.meta.name, rule: channelRule() } : null
    };
  }

  const handlers = {
    GET_STATE: () => undefined,
    SET_AUDIO_MODE: (message) => setAudioMode(message.enabled),
    TOGGLE_AUDIO_MODE: () => setAudioMode(!audioActive()),
    TOGGLE_FOCUS_MODE: () => setConfig({ focusMode: !state.config.focusMode }),
    SET_CONFIG: (message) => setConfig(message.patch),
    APPLY_PROFILE: (message) => applyProfile(message.profile),
    SET_TIMER: (message) => T.start(message.options),
    ADD_TIMER: (message) => T.addMinutes(message.minutes),
    SET_RATE: (message) => setPlaybackRate(Number(message.rate)),
    SKIP: (message) => P.skip(message.seconds),
    SET_CHANNEL_RULE: (message) => setChannelRule(Boolean(message.enabled))
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = handlers[message?.type];
    if (!handler) return false;
    Promise.resolve(handler(message)).then(() => sendResponse(publicState()), (error) => { console.warn("AudioTube:", error); sendResponse(publicState()); });
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (S.handleStorageChange(changes, area)) applyState();
  });

  document.addEventListener("yt-navigate-finish", () => {
    // Una desactivación explícita vale para el vídeo actual; en el siguiente vuelven las reglas automáticas.
    if (state.userAudio === false) S.setUserAudio(null);
    refreshContext();
  });
  document.addEventListener("yt-page-data-updated", refreshContext);
  // Los eventos de <video> no burbujean, pero sí se capturan: así se detecta cualquier vídeo nuevo sin sondeo.
  document.addEventListener("loadedmetadata", (event) => { if (event.target instanceof HTMLVideoElement) P.ensure(); }, true);

  async function initialize() {
    await S.load();
    P.init({ site, context: () => context, audioActive, onVideoLoaded, onRateChange: setPlaybackRate, addTime: () => T.addMinutes(10) });
    T.init({ video: () => P.video, update: () => P.renderTimer(T.status()) });
    injectBridge();
    refreshContext();
    P.renderTimer(T.status());
  }
  initialize();
})();
