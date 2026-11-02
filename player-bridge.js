(() => {
  const MAX_ATTEMPTS = 20, RETRY_MS = 750;
  let previousQuality = null;
  let qualityLimited = false;
  let pending = null;
  const player = () => document.querySelector("#movie_player");

  // YouTube puede ignorar "tiny" en algunos vídeos: es una petición, no una garantía.
  function setAudioQuality(enabled, attempt = 0) {
    const api = player();
    if (!api?.setPlaybackQualityRange) {
      if (attempt < MAX_ATTEMPTS) pending = setTimeout(() => setAudioQuality(enabled, attempt + 1), RETRY_MS);
      else console.warn("AudioTube: no se encuentra la API del reproductor (#movie_player.setPlaybackQualityRange). Puede que YouTube haya cambiado su página.");
      return;
    }
    try {
      if (enabled) {
        if (!qualityLimited) previousQuality = api.getPlaybackQuality?.() || previousQuality;
        api.setPlaybackQualityRange("tiny", "tiny");
        api.setPlaybackQuality?.("tiny");
        qualityLimited = true;
      } else if (qualityLimited) {
        const quality = previousQuality && previousQuality !== "unknown" ? previousQuality : "auto";
        api.setPlaybackQualityRange(quality === "auto" ? "auto" : quality);
        if (quality !== "auto") api.setPlaybackQuality?.(quality);
        previousQuality = null;
        qualityLimited = false;
      }
    } catch { /* El modo visual sigue funcionando si YouTube cambia su API privada. */ }
  }

  document.addEventListener("audiotube:quality", (event) => {
    clearTimeout(pending);
    setAudioQuality(Boolean(event.detail?.enabled));
  });
})();
