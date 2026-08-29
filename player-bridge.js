(() => {
  let previousQuality = null;
  let qualityLimited = false;
  function player() { return document.querySelector("#movie_player"); }
  function setAudioQuality(enabled) {
    const api = player();
    if (!api) return setTimeout(() => setAudioQuality(enabled), 750);
    try {
      if (enabled) {
        if (!qualityLimited) previousQuality = api.getPlaybackQuality?.() || previousQuality;
        api.setPlaybackQualityRange?.("tiny");
        api.setPlaybackQuality?.("tiny");
        qualityLimited = true;
      } else if (previousQuality) {
        api.setPlaybackQualityRange?.(previousQuality);
        api.setPlaybackQuality?.(previousQuality);
        previousQuality = null;
        qualityLimited = false;
      } else {
        api.setPlaybackQualityRange?.("auto");
        qualityLimited = false;
      }
    } catch { /* El modo visual sigue funcionando si YouTube cambia su API privada. */ }
  }
  document.addEventListener("audiotube:quality", (event) => setAudioQuality(Boolean(event.detail?.enabled)));
})();
