import { el, node, gameUrl, shareControls, parseSeed, randomSeed, readData, saveData } from "./core.js";
import { columnCount, columnHeight, createMerge, validMerge, holdTile, dropTile, mergeFull, tileLabel, createDodge, advanceDodge, playerY } from "./runs.js";

let active = "";
let merge, mergeSeed, lastDrop, resetPending = false;
let dodge, dodgeSeed, dodgeMode = "ready", frame = 0, lastTime = 0;
let ctx;
const road = el("d-road");
const columns = [];

function paintTarget(id, params, seed, word) {
  const text = el(id);
  text.hidden = seed === null;
  if (text.hidden) return;
  const value = params.get("b") || "";
  const points = /^\d{1,16}$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : 0;
  text.textContent = points ? "Your friend scored " + points + ". Try the same " + word + "." : "Friend challenge · Play the same " + word + ".";
}

function syncBest(key, id, score) {
  const saved = Number(readData(key, 0)) || 0;
  if (score > saved) saveData(key, score);
  el(id).textContent = String(Math.max(saved, score));
}

function scoreShare(name, title, run) {
  return { title: title + " · Minute Arcade", text: run.score ? "I scored " + run.score + " in " + title + ". Can you beat it?" : "Play the same " + title + " run as me.", url: gameUrl(name, { s: run.seed.toString(36), b: run.score }) };
}

function drawMerge() {
  el("m-score").textContent = merge.score;
  syncBest("fuse-best-v1", "m-best", merge.score);
  el("m-now").textContent = tileLabel(merge.current);
  el("m-next").textContent = tileLabel(merge.next);
  el("m-new").textContent = resetPending ? "Confirm restart" : mergeSeed !== null ? "Retry this challenge" : "New run";
  el("m-peak").textContent = tileLabel(Math.max(1,...merge.columns.flat()));
  el("m-chain").textContent = String(merge.longest || 0);
  el("m-hold").disabled = Boolean(merge.holdUsed) || mergeFull(merge);
  el("m-hold").textContent = merge.held ? "Swap with " + tileLabel(merge.held) : "Hold tile";
  columns.forEach(({ control, cells }, x) => {
    const stack = merge.columns[x];
    control.disabled = stack.length === columnHeight;
    const contents = stack.length ? "bottom to top " + stack.map(tileLabel).join(", ") : "empty";
    control.setAttribute("aria-label", "Drop in column " + (x + 1) + ", " + contents);
    cells.forEach((cell, y) => {
      const rank = stack[y];
      cell.className = "mc" + (rank ? " rank-" + ((rank - 1) % 8) : "");
      if (lastDrop?.x === x && lastDrop.row === y) cell.classList.add("landed");
      if (y === stack.length) cell.classList.add("landing-guide");
      cell.textContent = rank ? tileLabel(rank) : "";
    });
  });
}

for (let x = 0; x < columnCount; x++) {
  const control = node("button", undefined, "drop-column");
  control.type = "button";
  const cells = [];
  for (let y = columnHeight - 1; y >= 0; y--) {
    const cell = node("span", "", "mc");
    cell.setAttribute("aria-hidden", "true");
    cells[y] = cell;
    control.append(cell);
  }
  const number = node("span", String(x + 1), "col-key");
  number.setAttribute("aria-hidden", "true");
  control.append(number);
  control.addEventListener("click", () => moveMerge(x));
  el("m-board").append(control);
  columns.push({ control, cells });
}

function mergeMessage(text) {
  el("m-status").textContent = mergeFull(merge) ? "Board full. Final score " + merge.score + "." : text;
}

function moveMerge(x) {
  if (active !== "merge") return;
  const move = dropTile(merge, x);
  if (!move) return;
  lastDrop = { x, row: move.row };
  if (move.chain) arcade.point("merge",merge.drops,merge.seed.toString(36),"merge");
  resetPending = false;
  mergeMessage(move.chain > 1 ? move.chain + "-step chain! +" + move.gain + " points." : move.chain ? "Fused! +" + move.gain + " points." : "Tile landed in column " + (x + 1) + ".");
  if (mergeSeed === null) saveData("fuse-run-v1", merge);
  drawMerge();
}

el("m-hold").addEventListener("click", () => {
  if (!holdTile(merge)) return;
  if (mergeSeed === null) saveData("fuse-run-v1",merge);
  mergeMessage("Held " + tileLabel(merge.held) + ". Drop a tile before swapping again.");
  drawMerge();
});
el("m-new").addEventListener("click", () => {
  if (!resetPending && merge.drops > 0 && !mergeFull(merge)) {
    resetPending = true;
    mergeMessage("Start over? Press again to confirm, or drop a tile to keep this run.");
    drawMerge();
    return;
  }
  merge = createMerge(mergeSeed ?? randomSeed());
  lastDrop = null;
  resetPending = false;
  if (mergeSeed === null) saveData("fuse-run-v1", merge);
  mergeMessage("Choose a column for your first tile.");
  drawMerge();
});

function drawRoad() {
  if (!ctx) return;
  const width = 360, height = 350, laneWidth = 72;
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#101f30");
  background.addColorStop(1, "#101528");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#31455a";
  ctx.setLineDash([7, 10]);
  ctx.lineDashOffset = Math.floor(-(dodge.distance % 17));
  for (let lane = 1; lane < columnCount; lane++) {
    ctx.beginPath(); ctx.moveTo(lane * laneWidth, 0); ctx.lineTo(lane * laneWidth, height); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const gate of dodge.gates) {
    if (gate.y < -12 || gate.y > height + 12) continue;
    for (let lane = 0; lane < columnCount; lane++) {
      const x = lane * laneWidth;
      if (!gate.openings.includes(lane)) {
        ctx.fillStyle = "#f88295"; ctx.fillRect(x + 3, gate.y - 7, laneWidth - 6, 14);
        ctx.fillStyle = "#6c354f";
        for (let dx = 10; dx < laneWidth - 5; dx += 13) ctx.fillRect(x + dx, gate.y - 4, 4, 8);
      } else if (lane === gate.gold && !gate.passed) {
        const center = x + laneWidth / 2;
        ctx.fillStyle = "#ffdb82"; ctx.beginPath();
        ctx.moveTo(center, gate.y - 10); ctx.lineTo(center + 7, gate.y); ctx.lineTo(center, gate.y + 10); ctx.lineTo(center - 7, gate.y); ctx.closePath(); ctx.fill();
      }
    }
  }
  const shipX = (dodge.position + 0.5) * laneWidth;
  ctx.fillStyle = "#347b99"; ctx.beginPath();
  ctx.moveTo(shipX - 5, playerY + 9); ctx.lineTo(shipX, playerY + 25); ctx.lineTo(shipX + 5, playerY + 9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dodge.crashed ? "#ff9baf" : "#a1f7ff"; ctx.beginPath();
  ctx.moveTo(shipX, playerY - 14); ctx.lineTo(shipX + 12, playerY + 12); ctx.lineTo(shipX, playerY + 7); ctx.lineTo(shipX - 12, playerY + 12); ctx.closePath(); ctx.fill();
}

function dodgeUI() {
  el("d-cover").hidden = dodgeMode === "running";
  const titles = { ready: "Ready to run?", paused: "Paused", over: "Gate hit" };
  const labels = { ready: "Start run", running: "Pause", paused: "Resume", over: "Play again" };
  el("d-cover-title").textContent = titles[dodgeMode] || "";
  el("d-cover-text").textContent = dodgeMode === "over" ? "Final score " + dodge.score : dodgeMode === "paused" ? "Your course is right where you left it." : "Tap a lane or use the steering buttons.";
  el("d-action").textContent = labels[dodgeMode];
  el("d-left").disabled = el("d-right").disabled = dodgeMode !== "running";
  el("d-score").textContent = el("d-hud").textContent = dodge.score;
  syncBest("slip-best-v1", "d-best", dodge.score);
}

function pauseDodge() {
  if (dodgeMode !== "running") return;
  cancelAnimationFrame(frame);
  dodgeMode = "paused";
  lastTime = 0;
  el("d-status").textContent = "Run paused.";
  dodgeUI();
}

function tick(time) {
  if (active !== "slipstream" || dodgeMode !== "running") return;
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.08) : 0;
  lastTime = time;
  const oldScore = dodge.score, oldShards = dodge.shards;
  // Short physics steps keep collision decisions consistent on slower displays.
  for (let remaining = dt; remaining > 0 && !dodge.crashed; remaining -= 1 / 120) {
    advanceDodge(dodge, Math.min(remaining, 1 / 120));
  }
  drawRoad();
  if (dodge.crashed) {
    dodgeMode = "over";
    el("d-status").textContent = "Run over. " + dodge.cleared + " gates cleared, " + dodge.shards + " gold collected.";
    dodgeUI();
    return;
  }
  if (dodge.score !== oldScore) {
    el("d-score").textContent = el("d-hud").textContent = dodge.score;
    const gold = dodge.shards > oldShards;
    arcade.point("slipstream",dodge.cleared,dodge.seed.toString(36),gold ? "gold" : "point");
    el("d-bonus").textContent = gold ? "◆ Gold +2 · Gate +1" : "Gate +1";
    for(const id of ["d-score","d-hud"]){
      const n=el(id); n.classList.remove("gold-flash");
      if(gold){void n.offsetWidth; n.classList.add("gold-flash");}
    }
    syncBest("slip-best-v1", "d-best", dodge.score);
  }
  frame = requestAnimationFrame(tick);
}

function toggleDodge() {
  if (active !== "slipstream" || !ctx) return;
  if (dodgeMode === "running") return pauseDodge();
  if (dodgeMode === "over") dodge = createDodge(dodgeSeed ?? randomSeed());
  if(dodgeMode !== "paused") el("d-bonus").textContent="";
  dodgeMode = "running";
  lastTime = 0;
  el("d-status").textContent = "Steer through a gap. Gold is worth two extra.";
  dodgeUI();
  frame = requestAnimationFrame(tick);
}

function steer(lane) {
  if (dodgeMode === "running" && active === "slipstream") dodge.lane = Math.max(0, Math.min(4, lane));
}

el("d-left").addEventListener("click", () => steer(dodge.lane - 1));
el("d-right").addEventListener("click", () => steer(dodge.lane + 1));
el("d-action").addEventListener("click", toggleDodge);
function steerAt(event) {
  const rect = road.getBoundingClientRect();
  steer(Math.floor((event.clientX - rect.left) * columnCount / rect.width));
}
road.addEventListener("pointerdown", (event) => {
  if (dodgeMode !== "running") return;
  road.setPointerCapture(event.pointerId);
  steerAt(event);
});
road.addEventListener("pointermove", (event) => {
  if (road.hasPointerCapture(event.pointerId)) steerAt(event);
});
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseDodge(); });
window.addEventListener("pagehide", pauseDodge);
document.addEventListener("keydown", (event) => {
  if (arcade.suspended || event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.closest("input, textarea, select")) return;
  if (active === "merge" && /^[1-5]$/.test(event.key)) {
    event.preventDefault();
    moveMerge(Number(event.key) - 1);
  }
  if (active !== "slipstream") return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    steer(dodge.lane + (event.key === "ArrowLeft" ? -1 : 1));
  }
  if (event.key.toLowerCase() === "p") toggleDodge();
});

export function runRoute(name, params) {
  if (active === "slipstream") pauseDodge();
  active = name;
  if (name === "merge") {
    mergeSeed = parseSeed(params.get("s"));
    const stored = mergeSeed === null ? readData("fuse-run-v1") : null;
    merge = validMerge(stored) ? stored : createMerge(mergeSeed ?? randomSeed());
    if (mergeSeed === null && !validMerge(stored)) saveData("fuse-run-v1", merge);
    lastDrop = null;
    resetPending = false;
    paintTarget("m-target", params, mergeSeed, "drops");
    mergeMessage(merge.drops ? "Picked up where you left off." : "Choose a column for your first tile.");
    drawMerge();
    shareControls(el("m-share"), () => scoreShare("merge", "Fuse Drop", merge));
  }
  if (name === "slipstream") {
    dodgeSeed = parseSeed(params.get("s"));
    dodge = createDodge(dodgeSeed ?? randomSeed());
    dodgeMode = "ready";
    el("d-bonus").textContent="";
    ctx = road.getContext("2d");
    if (ctx) {
      const resolution = Math.min(window.devicePixelRatio || 1, 3);
      road.width = Math.round(360 * resolution);
      road.height = Math.round(350 * resolution);
      ctx.setTransform(road.width / 360, 0, 0, road.height / 350, 0, 0);
      drawRoad();
    }
    el("d-action").disabled = !ctx;
    paintTarget("d-target", params, dodgeSeed, "course");
    el("d-status").textContent = ctx ? "Five lanes. Find an opening." : "This browser could not draw the course.";
    dodgeUI();
    shareControls(el("d-share"), () => { pauseDodge(); return scoreShare("slipstream", "Slipstream", dodge); });
  }
}

if (arcade.demo) {
  arcade.demoFuse = () => {
    const options=[0,1,2,3,4].map(x=>{const copy=structuredClone(merge);const result=dropTile(copy,x);return {x,value:result ? result.gain*10-merge.columns[x].length : -10000};});
    return options.sort((a,b)=>b.value-a.value)[0].x;
  };
  arcade.demoSteer = () => {const gate=dodge?.gates.find(g=>!g.passed);return gate ? Math.sign(gate.gold-dodge.lane) : 0;};
}

let wasDodging=false;window.addEventListener("arcade:suspend",e=>{if(e.detail){wasDodging=dodgeMode==="running";pauseDodge();}else if(wasDodging&&active==="slipstream"){wasDodging=false;toggleDodge();}});
