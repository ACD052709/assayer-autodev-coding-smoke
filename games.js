"use strict";

const byId = (id) => document.getElementById(id);
const readBest = (game) => {
  try { return Number(arcade.local.getItem("minute-arcade-" + game)) || 0; }
  catch { return 0; }
};
const updateBest = (game, score) => {
  const best = Math.max(score, Number(byId(game + "-best").textContent));
  byId(game + "-best").textContent = String(best);
  try { arcade.local.setItem("minute-arcade-" + game, String(best)); } catch {}
};

const tiles = Array.from({ length: 9 }, (_, index) => {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "tile";
  tile.textContent = String(index + 1);
  tile.disabled = true;
  tile.addEventListener("click", () => selectTile(index));
  byId("tiles").append(tile);
  return tile;
});
byId("c-best").textContent = String(readBest("c"));
byId("o-best").textContent = String(readBest("o"));

let sequence = [];
let step = 0;
let circuitRound = 0;
let circuitPhase = "idle";
let circuitTimers = [];
const circuitStatus = byId("c-status");
const circuitStart = byId("c-start");

function circuitDelay(callback, delay) {
  const task={callback,remaining:delay,deadline:performance.now()+delay,id:0};
  task.fire=()=>{task.done=true;callback();};
  task.id=setTimeout(task.fire,delay);
  circuitTimers.push(task);
}

function clearCircuit() {
  circuitTimers.forEach(t=>clearTimeout(t.id));
  circuitTimers = [];
  circuitPhase = "idle";
  tiles.forEach((tile) => {
    tile.className = "tile";
    tile.disabled = true;
  });
}

function circuitTurn(delay) {
  circuitPhase = "show";
  sequence.push(Math.floor(arcade.roll("circuit") * 9));
  step = 0;
  tiles.forEach((tile) => { tile.disabled = true; });
  circuitStatus.textContent = "Watch round " + sequence.length;
  const interval = Math.max(410, 720 - sequence.length * 15);
  sequence.forEach((index, position) => {
    circuitDelay(() => {
      tiles[index].classList.add("lit");
      circuitDelay(() => tiles[index].classList.remove("lit"), interval * .57);
    }, delay + interval * position);
  });
  circuitDelay(() => {
    circuitTimers = [];
    circuitPhase = "input";
    tiles.forEach((tile) => { tile.disabled = false; });
    circuitStatus.textContent = "Your turn. Repeat the sequence.";
  }, delay + interval * sequence.length);
}

function selectTile(index) {
  if (circuitPhase !== "input") return;
  const tile = tiles[index];
  if (index !== sequence[step]) {
    clearCircuit();
    tile.classList.add("miss");
    circuitStatus.textContent = "Signal lost. Final score " + circuitRound + ".";
    circuitStart.textContent = "Play again";
    circuitStart.focus({ preventScroll: true });
    return;
  }
  tile.classList.add("hit");
  circuitDelay(() => tile.classList.remove("hit"), 160);
  step += 1;
  if (step === sequence.length) {
    circuitRound += 1;
    byId("c-score").textContent = String(circuitRound);
    updateBest("c", circuitRound);
    arcade.point("circuit", circuitRound);
    circuitTurn(800);
  }
}

circuitStart.addEventListener("click", () => {
  clearCircuit();
  arcade.start("circuit");
  sequence = [];
  circuitRound = 0;
  byId("c-score").textContent = "0";
  circuitStart.textContent = "Restart Circuit";
  circuitTurn(500);
});

const orbitStart = byId("o-start");
const orbitStatus = byId("o-status");
const fullCircle = Math.PI * 2;
let orbitActive = false;
let orbitFrame = 0;
let angle = Math.PI;
let targetCenter = 0;
let halfWidth = .52;
let speed = 1.9;
let orbitScore = 0;
let lives = 3;
let lastFrame = 0;
let lastLock = -Infinity;

function pointAlongRing(radians) {
  return [150 + 119 * Math.cos(radians), 150 + 119 * Math.sin(radians)];
}

function placeSatellite() {
  const [x, y] = pointAlongRing(angle);
  byId("satellite").setAttribute("cx", x);
  byId("satellite").setAttribute("cy", y);
}

function placeTarget() {
  const start = pointAlongRing(targetCenter - halfWidth);
  const end = pointAlongRing(targetCenter + halfWidth);
  byId("target").setAttribute("d", "M" + start.join(" ") + " A119 119 0 0 1 " + end.join(" "));
}

function spin(time) {
  if (!orbitActive) return;
  if(arcade.suspended){lastFrame=0;orbitFrame=requestAnimationFrame(spin);return;}
  if (lastFrame) angle = (angle + speed * Math.min((time - lastFrame) / 1000, .06)) % fullCircle;
  lastFrame = time;
  placeSatellite();
  orbitFrame = requestAnimationFrame(spin);
}

function stopOrbit() {
  orbitActive = false;
  cancelAnimationFrame(orbitFrame);
  lastFrame = 0;
}

function launchOrbit() {
  arcade.start("orbit");
  angle = Math.PI;
  lastLock = -Infinity;
  targetCenter = 0;
  halfWidth = .52;
  speed = 1.9;
  orbitScore = 0;
  lives = 3;
  byId("o-score").textContent = "0";
  byId("o-lives").textContent = "3";
  orbitStatus.textContent = "Lock on inside the green arc.";
  orbitStart.textContent = "Lock on";
  placeTarget();
  placeSatellite();
  orbitActive = true;
  orbitFrame = requestAnimationFrame(spin);
}

function lockOrbit() {
  if (!orbitActive) {
    launchOrbit();
    return;
  }

  const time = performance.now();
  if (time - lastLock < 330) return;
  lastLock = time;
  const offset = angle - targetCenter;
  const distance = Math.abs(Math.atan2(Math.sin(offset), Math.cos(offset)));
  if (distance <= halfWidth) {
    orbitScore += 1;
    byId("o-score").textContent = String(orbitScore);
    updateBest("o", orbitScore);
    const curve = arcade.orbitCurve(orbitScore);
    halfWidth = curve.width;
    speed = curve.speed;
    arcade.point("orbit", orbitScore);
    targetCenter = (angle + 1.3 + arcade.roll("orbit") * 3.1) % fullCircle;
    placeTarget();
    orbitStatus.textContent = "Locked. Aim for the next arc.";
    return;
  }

  lives -= 1;
  byId("o-lives").textContent = String(lives);
  if (lives) {
    orbitStatus.textContent = "Missed. " + lives + (lives === 1 ? " life left." : " lives left.");
    return;
  }
  stopOrbit();
  orbitStatus.textContent = "Run complete. Final score " + orbitScore + ".";
  orbitStart.textContent = "Play again";
}

orbitStart.addEventListener("click", lockOrbit);
placeTarget();
placeSatellite();

const gameRoutes = ["circuit", "orbit", "switchyard", "cargo", "merge", "slipstream", "letterlift", "thread", "dial", "sum", "trail", "pairs", "code", "scores", "account"];
let route = "";
function showRoute() {
  clearCircuit();
  stopOrbit();
  const hash = location.hash.slice(1).split("?")[0];
  const previous = route;
  if(hash !== "switchyard" && ["circuit","orbit","cargo"].includes(hash)) arcade.clearSeed(hash);
  route = gameRoutes.includes(hash) ? hash : "home";
  arcade.route = route;
  ["home", ...gameRoutes].forEach((section) => { if (byId(section)) byId(section).hidden = route !== section; });
  document.querySelectorAll("[data-route]").forEach((link) => {
    if (link.dataset.route === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  circuitStatus.textContent = "Ready to play?";
  circuitStart.textContent = "Start Circuit";
  byId("c-score").textContent = "0";
  orbitStatus.textContent = "Ready to play?";
  orbitStart.textContent = "Start Orbit";
  byId("o-lives").textContent = "3";
  byId("o-score").textContent = "0";
  angle = Math.PI;
  targetCenter = 0;
  halfWidth = .52;
  placeTarget();
  placeSatellite();
  if (previous) {
    window.dispatchEvent(new CustomEvent("arcade:route", { detail: route }));
    if (previous !== route) {
      const heading = byId(route)?.querySelector("h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }
}

window.addEventListener("hashchange", showRoute);
document.addEventListener("keydown", (event) => {
  if (arcade.suspended || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  if (route === "circuit" && /^[1-9]$/.test(event.key)) selectTile(Number(event.key) - 1);
  if (route === "orbit" && event.code === "Space") {
    if (event.target.closest("a") || (event.target.closest("button") && event.target !== orbitStart)) return;
    event.preventDefault();
    lockOrbit();
  }
});
showRoute();

if (arcade.demo) arcade.classicDemo = { circuit: () => circuitPhase === "input" ? sequence[step] : null, orbit: () => orbitActive && Math.abs(Math.atan2(Math.sin(angle-targetCenter),Math.cos(angle-targetCenter))) < halfWidth };

window.addEventListener("arcade:suspend",e=>{for(const t of circuitTimers){if(t.done)continue;if(e.detail){clearTimeout(t.id);t.remaining=Math.max(0,t.deadline-performance.now());}else{t.deadline=performance.now()+t.remaining;t.id=setTimeout(t.fire,t.remaining);}}});
