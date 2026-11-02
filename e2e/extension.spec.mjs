import { test, expect, openYouTube, watchPage } from "./fixtures.mjs";

const rootClass = (page) => page.evaluate(() => document.documentElement.className);

test("el solo audio muestra el reproductor compacto y oculta los controles de YouTube", async ({ context, send }) => {
  const page = await openYouTube(context, send);
  const state = await send({ type: "SET_AUDIO_MODE", enabled: true });
  expect(state.audioMode).toBe(true);
  expect(state.channel).toEqual({ name: "Canal de prueba", rule: false });
  await expect(page.locator("#audiotube-player")).toBeVisible();
  await expect(page.locator("#audiotube-player [data-ref='title']")).toHaveText("Vídeo de prueba");
  await expect(page.locator(".ytp-chrome-bottom")).toBeHidden();
});

test("durante un anuncio se ven los controles de YouTube para poder saltarlo", async ({ context, send }) => {
  const page = await openYouTube(context, send);
  await send({ type: "SET_AUDIO_MODE", enabled: true });
  await page.evaluate(() => document.querySelector("#movie_player").classList.add("ad-showing"));
  await expect(page.locator("#audiotube-player")).toBeHidden();
  await expect(page.locator(".ytp-chrome-bottom")).toBeVisible();
});

test("el modo concentración no afecta a páginas que no son de vídeo", async ({ context, send }) => {
  const page = await openYouTube(context, send, "/");
  await send({ type: "SET_CONFIG", patch: { focusMode: true } });
  expect(await rootClass(page)).not.toContain("audiotube-focus-mode");
  await expect(page.locator("ytd-masthead")).toBeVisible();
});

test("desactivar la concentración mantiene el solo audio elegido por el usuario", async ({ context, send }) => {
  await openYouTube(context, send);
  await send({ type: "SET_AUDIO_MODE", enabled: true });
  await send({ type: "SET_CONFIG", patch: { focusMode: true } });
  const state = await send({ type: "SET_CONFIG", patch: { focusMode: false } });
  expect(state.audioMode).toBe(true);
});

test("la velocidad 0,75× aparece seleccionada y se recuerda por canal", async ({ context, send, worker }) => {
  const page = await openYouTube(context, send);
  await send({ type: "SET_AUDIO_MODE", enabled: true });
  const state = await send({ type: "SET_RATE", rate: 0.75 });
  expect(state.playbackRate).toBe(0.75);
  await expect(page.locator("#audiotube-player select")).toHaveValue("0.75");
  const stored = await worker.evaluate(() => chrome.storage.local.get("channelSpeeds"));
  expect(stored.channelSpeeds).toEqual({ "/@canal": 0.75 });
});

test("el fundido baja el volumen y +10 min lo recupera", async ({ context, send }) => {
  const page = await openYouTube(context, send);
  const volume = () => page.evaluate(() => document.querySelector("video").volume);
  const state = await send({ type: "SET_TIMER", options: { mode: "minutes", minutes: 0.5, fade: true } });
  expect(state.timer).toMatchObject({ mode: "minutes", fade: true });
  await expect.poll(volume).toBeLessThan(0.6);
  await send({ type: "ADD_TIMER", minutes: 10 });
  await expect.poll(volume).toBe(1);
});

test("«al terminar el vídeo» desactiva la reproducción automática y la reactiva al reproducir otra vez", async ({ context, send }) => {
  const page = await openYouTube(context, send);
  const autoplay = page.locator(".ytp-autonav-toggle-button");
  await send({ type: "SET_TIMER", options: { mode: "end-video" } });
  await page.evaluate(() => document.querySelector("video").play());
  await expect(autoplay).toHaveAttribute("aria-checked", "false");
  expect((await send({ type: "GET_STATE" })).timer).toBeNull();
  await page.evaluate(() => document.querySelector("video").play());
  await expect(autoplay).toHaveAttribute("aria-checked", "true");
});

test("la regla de canal activa el solo audio automáticamente", async ({ context, send }) => {
  const page = await openYouTube(context, send);
  const state = await send({ type: "SET_CHANNEL_RULE", enabled: true });
  expect(state.channel.rule).toBe(true);
  expect(state.audioMode).toBe(true);
  expect(await rootClass(page)).toContain("audiotube-audio-mode");
});

test.describe("con una página de YouTube cambiada", () => {
  test.use({ pages: { "/watch?v=roto": watchPage({ videoId: "roto", channel: false, player: false }) } });

  test("avisa en consola de los selectores que ya no funcionan", async ({ context, send }) => {
    const warnings = [];
    context.on("console", (message) => { if (message.type() === "warning") warnings.push(message.text()); });
    await openYouTube(context, send, "/watch?v=roto");
    await expect.poll(() => warnings.join("\n"), { timeout: 10000 }).toContain("«channel»");
    expect(warnings.join("\n")).toContain("«video»");
    expect(warnings.join("\n")).toContain("«player»");
  });
});

test("el popup muestra el atajo asignado y nunca un valor inventado", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator("#notice")).toBeVisible();
  const shortcut = page.locator("#shortcut");
  await expect(shortcut).not.toBeEmpty();
  await expect(shortcut).not.toContainText("Alt");
});
