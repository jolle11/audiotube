// Genera icons/icon-{16,32,48,128}.png a partir de icons/icon.svg.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const svg = readFileSync("icons/icon.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `icons/icon-${size}.png`, omitBackground: true });
}
await browser.close();
