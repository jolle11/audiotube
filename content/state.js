"use strict";

// Configuración persistente (sync), datos voluminosos (local) y estado de la pestaña (sessionStorage).
const AudioTubeState = (() => {
  const U = AudioTubeUtil;
  const SYNC_DEFAULTS = { autoEnable: false, hideThumbnails: false, focusMode: false, smartQuality: true, rememberSpeed: true, resumePosition: true, skipSeconds: 15, profile: "custom" };
  // storage.sync admite ~8 KB por clave: los mapas que crecen van a storage.local con límite LRU.
  const LOCAL_DEFAULTS = { channelSpeeds: {}, channelRules: {}, positions: {} };
  const LIMITS = { channelSpeeds: 500, channelRules: 500, positions: 300 };
  const USER_AUDIO_KEY = "audiotubeUserAudio";

  const PROFILES = {
    music: { audio: true, config: { hideThumbnails: false, focusMode: false, smartQuality: true, skipSeconds: 10 } },
    podcast: { audio: true, config: { hideThumbnails: true, focusMode: false, smartQuality: true, skipSeconds: 30, resumePosition: true } },
    focus: { audio: true, config: { hideThumbnails: true, focusMode: true, smartQuality: true, skipSeconds: 15 } },
    sleep: { audio: true, config: { hideThumbnails: true, focusMode: true, smartQuality: true }, timer: { mode: "minutes", minutes: 30, fade: true } }
  };

  const state = {
    config: { ...SYNC_DEFAULTS },
    local: structuredClone(LOCAL_DEFAULTS),
    // Elección explícita del usuario en esta pestaña: true, false o null (seguir reglas automáticas).
    userAudio: null
  };

  const warn = (error) => console.warn("AudioTube:", error);

  async function load() {
    const [config, local] = await Promise.all([chrome.storage.sync.get(SYNC_DEFAULTS), chrome.storage.local.get(LOCAL_DEFAULTS)]);
    state.config = config;
    state.local = local;
    const saved = sessionStorage.getItem(USER_AUDIO_KEY);
    state.userAudio = saved === null ? null : saved === "true";
  }

  function setUserAudio(value) {
    state.userAudio = value;
    if (value === null) sessionStorage.removeItem(USER_AUDIO_KEY);
    else sessionStorage.setItem(USER_AUDIO_KEY, String(value));
  }

  async function setConfig(patch) {
    state.config = { ...state.config, ...patch };
    await chrome.storage.sync.set(patch).catch(warn);
  }

  // Guarda (o borra con value undefined) una entrada de un mapa local respetando su límite.
  async function remember(mapName, key, value) {
    state.local[mapName] = U.lruSet(state.local[mapName] || {}, key, value, LIMITS[mapName]);
    await chrome.storage.local.set({ [mapName]: state.local[mapName] }).catch(warn);
  }

  // Devuelve true si cambió algo que afecte a la vista.
  function handleStorageChange(changes, area) {
    const target = area === "sync" ? state.config : area === "local" ? state.local : null;
    if (!target) return false;
    Object.entries(changes).forEach(([key, { newValue }]) => {
      const defaults = area === "sync" ? SYNC_DEFAULTS : LOCAL_DEFAULTS;
      if (key in defaults) target[key] = newValue ?? structuredClone(defaults[key]);
    });
    return true;
  }

  return { state, PROFILES, load, setUserAudio, setConfig, remember, handleStorageChange };
})();
