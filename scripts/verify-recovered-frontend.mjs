#!/usr/bin/env node
// Read-only verification of Minute Arcade's recovered public frontend.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const required = [
  "index.html", "privacy.html", "style.css", "arcade.css", "club.css",
  "foundation.js", "games.js", "more-games.js",
  "arcade/arcade.js", "arcade/core.js", "arcade/play.js",
  "arcade/bonus.js", "arcade/words.js", "arcade/dial.js",
  "arcade/club.js", "arcade/demos.js", "arcade/banners.js",
  "arcade/runs.js", "arcade/puzzles.js", "arcade/relay.js",
];
let checks = 0;
for (const p of required) {
  assert(fs.existsSync(p) && fs.statSync(p).size > 0, "Missing/empty: " + p);
  checks++;
}
const read = (p) => fs.readFileSync(p, "utf8");
function resolveLocal(from, ref) {
  if (/^(https?:|data:|mailto:|#|javascript:)/i.test(ref)) return;
  const clean = ref.split(/[?#]/, 1)[0];
  if (!clean || clean === "/") return;
  const normalized = clean.startsWith("/")
    ? clean.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(from), clean));
  assert(!normalized.startsWith("../") && normalized !== "..", "Unsafe reference " + ref);
  assert(fs.existsSync(normalized), "Broken local reference from " + from + ": " + ref);
  checks++;
}
for (const page of ["index.html", "privacy.html"]) {
  const html = read(page);
  assert(/<title>[^<]+<\/title>/i.test(html), "Missing title: " + page);
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g))
    resolveLocal(page, match[1]);
}
for (const script of required.filter(x => x.endsWith(".js"))) {
  const code = read(script);
  for (const match of code.matchAll(/\bfrom\s*["'](\.[^"']+)["']/g))
    resolveLocal(script, match[1]);
  for (const match of code.matchAll(/\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g))
    resolveLocal(script, match[1]);
}
if (fs.existsSync("manifest.webmanifest")) {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert(manifest.name && manifest.start_url, "Invalid web manifest");
  for (const icon of manifest.icons || []) resolveLocal("index.html", icon.src);
  checks++;
}
if (fs.existsSync("assets/icons/icon-192.png")) {
  const signature = fs.readFileSync("assets/icons/icon-192.png").subarray(0,8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a", "Icon PNG header invalid");
  checks++;
}
console.log("PASS: " + required.length + " original public frontend files verified; " + checks + " checks.");
