// Carga la extensión real en Chromium y sirve páginas falsas de YouTube interceptando la red.
import { test as base, chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const extensionPath = fileURLToPath(new URL("..", import.meta.url));

// WAV de silencio: un <video> con duración real para probar eventos como "ended".
function silentWav(seconds = 1, rate = 8000) {
  const samples = seconds * rate, buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}

export function watchPage({ videoId = "abc", channel = true, player = true } = {}) {
  const owner = channel ? `<ytd-channel-name><a href="/@canal">Canal de prueba</a></ytd-channel-name>` : "";
  const video = `<video src="/test.wav" preload="auto"></video>`;
  const playerHtml = player
    ? `<div id="movie_player"><div class="html5-video-container">${video}</div><div class="ytp-chrome-bottom">controles</div>
       <button class="ytp-autonav-toggle-button" aria-checked="true" onclick="this.setAttribute('aria-checked', String(this.getAttribute('aria-checked') !== 'true'))"></button></div>`
    : `<div id="other_player">${video}</div>`;
  return `<!doctype html><html><head><title>Vídeo de prueba - YouTube</title></head><body>
    <ytd-masthead>cabecera</ytd-masthead>
    <ytd-watch-flexy video-id="${videoId}"><div id="primary">${playerHtml}
      <ytd-watch-metadata><h1><yt-formatted-string>Vídeo de prueba</yt-formatted-string></h1>${owner}</ytd-watch-metadata></div>
    </ytd-watch-flexy></body></html>`;
}

export const homePage = () => `<!doctype html><html><head><title>YouTube</title></head><body><ytd-masthead>cabecera</ytd-masthead><p>portada</p></body></html>`;

export const test = base.extend({
  pages: [{}, { option: true }],
  context: async ({ pages }, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, "--autoplay-policy=no-user-gesture-required"]
    });
    const wav = silentWav();
    await context.route("https://www.youtube.com/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/test.wav") return route.fulfill({ body: wav, contentType: "audio/wav" });
      const body = pages[url.pathname + url.search] ?? (url.pathname === "/watch" ? watchPage({ videoId: url.searchParams.get("v") }) : homePage());
      return route.fulfill({ body, contentType: "text/html; charset=utf-8" });
    });
    await use(context);
    await context.close();
  },
  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await use(worker);
  },
  extensionId: async ({ worker }, use) => use(new URL(worker.url()).host),
  // Envía un mensaje al content script de la pestaña de YouTube, como hace el popup.
  send: async ({ worker }, use) => {
    await use((message) => worker.evaluate(async (msg) => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
      return chrome.tabs.sendMessage(tab.id, msg);
    }, message));
  }
});

// Espera a que el content script responda en la página.
export async function openYouTube(context, send, path = "/watch?v=abc") {
  const page = await context.newPage();
  await page.goto(`https://www.youtube.com${path}`);
  await test.expect.poll(() => send({ type: "GET_STATE" }).catch(() => null)).not.toBeNull();
  return page;
}

export { expect } from "@playwright/test";
