"use strict";

// Funciones puras compartidas por el content script, el popup y los tests.
(function (root) {
  const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const FADE_WINDOW_MS = 60000;
  const RESUME_MIN_DURATION = 20 * 60;
  const RESUME_MARGIN = 30;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = String(Math.floor(seconds % 60)).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
  }

  function formatRemaining(ms) {
    const total = Math.ceil(Math.max(0, ms) / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  // Normaliza una velocidad para usarla como value de <option>: 0.75 → "0.75", 1.1000001 → "1.1".
  const rateValue = (rate) => String(Math.round(Number(rate) * 100) / 100);

  // Lista de velocidades a mostrar, incluyendo la actual si no está entre las predefinidas.
  function rateOptions(current) {
    const rates = [...RATES];
    const value = Number(rateValue(current));
    if (Number.isFinite(value) && value > 0 && !rates.includes(value)) rates.push(value);
    return rates.sort((a, b) => a - b);
  }

  // Inserta o actualiza una clave al final y descarta las más antiguas por encima del límite.
  function lruSet(map, key, value, limit) {
    const next = { ...map };
    delete next[key];
    if (value !== undefined) next[key] = value;
    const keys = Object.keys(next);
    keys.slice(0, Math.max(0, keys.length - limit)).forEach((old) => { delete next[old]; });
    return next;
  }

  function detectSite(loc) {
    if (loc.hostname === "music.youtube.com") return "music";
    if (loc.pathname.startsWith("/shorts/")) return "shorts";
    if (loc.pathname === "/watch" || loc.pathname.startsWith("/live/")) return "watch";
    return "browse";
  }

  function videoIdFrom(loc) {
    const fromQuery = new URLSearchParams(loc.search).get("v");
    if (fromQuery) return fromQuery;
    const match = loc.pathname.match(/^\/(?:shorts|live)\/([\w-]+)/);
    return match ? match[1] : null;
  }

  const isYouTubeUrl = (url) => /^https:\/\/(www|music)\.youtube\.com\//.test(url || "");

  // Volumen durante el último minuto del temporizador con fundido.
  function fadedVolume(originalVolume, remainingMs) {
    if (remainingMs >= FADE_WINDOW_MS) return originalVolume;
    return Math.max(0, originalVolume * remainingMs / FADE_WINDOW_MS);
  }

  function shouldResume(savedTime, duration) {
    return Number.isFinite(savedTime) && Number.isFinite(duration) && duration >= RESUME_MIN_DURATION
      && savedTime > RESUME_MARGIN && savedTime < duration - RESUME_MARGIN;
  }

  const api = { RATES, FADE_WINDOW_MS, RESUME_MIN_DURATION, formatTime, formatRemaining, rateValue, rateOptions, lruSet, detectSite, videoIdFrom, isYouTubeUrl, fadedVolume, shouldResume };
  root.AudioTubeUtil = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
