import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const U = createRequire(import.meta.url)("../content/util.js");
const loc = (url) => new URL(url);

test("formatTime", () => {
  assert.equal(U.formatTime(0), "0:00");
  assert.equal(U.formatTime(65), "1:05");
  assert.equal(U.formatTime(3725), "1:02:05");
  assert.equal(U.formatTime(NaN), "0:00");
});

test("rateValue normaliza el valor del <option>", () => {
  assert.equal(U.rateValue(0.75), "0.75");
  assert.equal(U.rateValue("0.75"), "0.75");
  assert.equal(U.rateValue(1.1000001), "1.1");
});

test("rateOptions incluye velocidades fuera de la lista", () => {
  assert.deepEqual(U.rateOptions(1), U.RATES);
  assert.deepEqual(U.rateOptions(1.1), [0.75, 1, 1.1, 1.25, 1.5, 1.75, 2]);
});

test("lruSet limita el tamaño y mueve al final la clave usada", () => {
  let map = {};
  ["a", "b", "c"].forEach((key) => { map = U.lruSet(map, key, 1, 2); });
  assert.deepEqual(Object.keys(map), ["b", "c"]);
  map = U.lruSet(map, "b", 2, 2);
  assert.deepEqual(Object.keys(map), ["c", "b"]);
  assert.deepEqual(U.lruSet(map, "c", undefined, 2), { b: 2 });
});

test("detectSite y videoIdFrom", () => {
  assert.equal(U.detectSite(loc("https://www.youtube.com/watch?v=abc")), "watch");
  assert.equal(U.detectSite(loc("https://www.youtube.com/live/abc")), "watch");
  assert.equal(U.detectSite(loc("https://www.youtube.com/shorts/abc")), "shorts");
  assert.equal(U.detectSite(loc("https://music.youtube.com/watch?v=abc")), "music");
  assert.equal(U.detectSite(loc("https://www.youtube.com/")), "browse");
  assert.equal(U.videoIdFrom(loc("https://www.youtube.com/watch?v=abc&t=3")), "abc");
  assert.equal(U.videoIdFrom(loc("https://www.youtube.com/shorts/x_Y-1")), "x_Y-1");
  assert.equal(U.videoIdFrom(loc("https://www.youtube.com/")), null);
});

test("isYouTubeUrl", () => {
  assert.ok(U.isYouTubeUrl("https://music.youtube.com/watch?v=a"));
  assert.ok(!U.isYouTubeUrl("https://example.com/"));
  assert.ok(!U.isYouTubeUrl(undefined));
});

test("fadedVolume solo baja en el último minuto", () => {
  assert.equal(U.fadedVolume(0.8, 120000), 0.8);
  assert.equal(U.fadedVolume(0.8, 30000), 0.4);
  assert.equal(U.fadedVolume(0.8, -5), 0);
});

test("shouldResume", () => {
  assert.ok(U.shouldResume(600, 3600));
  assert.ok(!U.shouldResume(600, 600));
  assert.ok(!U.shouldResume(10, 3600));
  assert.ok(!U.shouldResume(3590, 3600));
  assert.ok(!U.shouldResume(undefined, 3600));
});
