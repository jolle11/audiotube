// Genera dist/chrome y dist/firefox a partir de los mismos ficheros.
// Firefox (MV3) no admite background.service_worker: usa background.scripts y necesita un id de gecko.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILES = ["manifest.json", "background.js", "player-bridge.js", "content.css", "popup.html", "popup.css", "popup.js", "content", "_locales", "icons"];
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

const targets = {
  chrome: manifest,
  firefox: {
    ...manifest,
    background: { scripts: ["background.js"] },
    browser_specific_settings: { gecko: { id: "audiotube@jolle11", strict_min_version: "128.0" } }
  }
};

rmSync("dist", { recursive: true, force: true });
for (const [name, targetManifest] of Object.entries(targets)) {
  const out = join("dist", name);
  mkdirSync(out, { recursive: true });
  FILES.forEach((file) => cpSync(file, join(out, file), { recursive: true }));
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(targetManifest, null, 2)}\n`);
  console.log(`✓ ${out}`);
}
