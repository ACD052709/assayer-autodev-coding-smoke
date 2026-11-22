#!/usr/bin/env node
// Safe GET-only website compatibility checks; creates no player accounts or awards.
import assert from "node:assert/strict";
const base = (process.argv[2] || "https://minute-arcade.com").replace(/\/+$/, "");
const endpoints = ["/", "/privacy.html", "/api/me", "/api/placements", "/api/board"];
for (const route of endpoints) {
  const res = await fetch(base + route, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  assert.equal(res.status, 200, route + ": expected HTTP 200, got " + res.status);
  if (route.startsWith("/api/")) {
    const data = await res.json();
    if (route === "/api/me") assert("player" in data, "Missing player field");
    if (route === "/api/board") assert(Array.isArray(data.rows), "Missing rankings array");
    if (route === "/api/placements") assert(data && typeof data === "object", "Bad placement response");
  } else {
    const html = await res.text();
    assert(html.includes("Minute Arcade") || html.includes("Player privacy"), "Unexpected HTML at " + route);
  }
  console.log("PASS", route, res.status);
}
console.log("GET-only checks passed against", base);
