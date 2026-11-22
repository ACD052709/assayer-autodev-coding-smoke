"use strict";

const switchSize = 4;
const switchCount = switchSize * switchSize;
const switchStatus = byId("s-status");
const switchBoard = byId("switches");
let startLights;
let switchSolution = [];
let lights;
let switchMoves = 0;
let puzzleSolved = false;

function flipSwitch(board, index) {
  const row = Math.floor(index / switchSize);
  const column = index % switchSize;
  const directions = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dy, dx] of directions) {
    const y = row + dy;
    const x = column + dx;
    if (y < 0 || y >= switchSize || x < 0 || x >= switchSize) continue;
    const neighbor = y * switchSize + x;
    board[neighbor] = !board[neighbor];
  }
}

const switches = Array.from({ length: switchCount }, (_, index) => {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "tile";
  tile.setAttribute("aria-label", "Switch " + (index + 1));
  tile.addEventListener("click", () => pressSwitch(index));
  switchBoard.append(tile);
  return tile;
});

function renderSwitchyard() {
  switches.forEach((tile, index) => {
    tile.setAttribute("aria-pressed", String(lights[index]));
    tile.textContent = lights[index] ? "●" : "○";
    tile.disabled = puzzleSolved;
  });
  byId("s-moves").textContent = String(switchMoves);
}

function resetSwitchyard() {
  lights = [...startLights];
  switchMoves = 0;
  puzzleSolved = false;
  switchStatus.textContent = "Turn off all the lights.";
  renderSwitchyard();
}

function newSwitchyard() {
  arcade.start("switchyard");
  switchSolution = [];
  const available = Array.from({ length: switchCount }, (_, index) => index);
  startLights = Array(switchCount).fill(false);
  for (let count = 0; count < 6; count++) {
    const position = Math.floor(arcade.roll("switchyard") * available.length);
    const [index] = available.splice(position, 1);
    switchSolution.push(index);
    flipSwitch(startLights, index);
  }
  if (!startLights.some(Boolean)) { flipSwitch(startLights, 0); switchSolution.push(0); }
  resetSwitchyard();
}

function pressSwitch(index) {
  if (puzzleSolved) return;
  flipSwitch(lights, index);
  switchMoves += 1;
  puzzleSolved = !lights.some(Boolean);
  renderSwitchyard();
  if (!puzzleSolved) return;
  arcade.point("switchyard", "solve");
  switchStatus.textContent = "Yard clear in " + switchMoves + (switchMoves === 1 ? " move." : " moves.");
  const previousBest = readBest("s");
  const best = previousBest ? Math.min(previousBest, switchMoves) : switchMoves;
  byId("s-best").textContent = String(best);
  try { arcade.local.setItem("minute-arcade-s", String(best)); } catch {}
  byId("s-new").focus({ preventScroll: true });
}

byId("s-best").textContent = readBest("s") || "—";
byId("s-new").addEventListener("click", newSwitchyard);
byId("s-reset").addEventListener("click", resetSwitchyard);
newSwitchyard();

const cargoStatus = byId("g-status");
const cargoTime = byId("g-time");
const cargoCrate = byId("g-crate");
const cargoOdd = byId("g-odd");
const cargoEven = byId("g-even");
const cargoStart = byId("g-start");
const runDuration = 25000;
let cargoActive = false;
let cargoTimer;
let cargoDeadline = 0;
let cargoValue = 0;
let cargoScore = 0;
let cargoStreak = 0;

function nextCrate() {
  let value = 1 + Math.floor(arcade.roll("cargo") * 98);
  if (value >= cargoValue) value += 1;
  cargoValue = value;
  cargoCrate.textContent = String(value);
  cargoOdd.setAttribute("aria-label", "Sort " + value + " as odd");
  cargoEven.setAttribute("aria-label", "Sort " + value + " as even");
}

function finishCargo(status) {
  cargoActive = false;
  clearInterval(cargoTimer);
  cargoOdd.disabled = true;
  cargoEven.disabled = true;
  cargoStart.hidden = false;
  cargoStart.textContent = "Play again";
  cargoStatus.textContent = status;
}

function updateCargoClock() {
  if(arcade.suspended)return;
  const remaining = Math.max(0, cargoDeadline - performance.now());
  cargoTime.textContent = (remaining / 1000).toFixed(1);
  if (!remaining) finishCargo("Time up. Final score " + cargoScore + ".");
}

let cargoHits = 0;
function startCargo() {
  arcade.start("cargo"); cargoHits = 0;
  cargoScore = 0;
  cargoStreak = 0;
  cargoValue = 0;
  byId("g-score").textContent = "0";
  byId("g-streak").textContent = "0";
  cargoActive = true;
  cargoDeadline = performance.now() + runDuration;
  cargoStatus.textContent = "Which bin does this crate belong in?";
  cargoOdd.disabled = false;
  cargoEven.disabled = false;
  cargoStart.hidden = true;
  nextCrate();
  cargoOdd.focus({ preventScroll: true });
  updateCargoClock();
  cargoTimer = window.setInterval(updateCargoClock, 75);
}

function sortCargo(isOdd) {
  if (!cargoActive) return;
  updateCargoClock();
  if (!cargoActive) return;

  if ((cargoValue % 2 === 1) === isOdd) {
    cargoStreak += 1; cargoHits++;
    if (cargoHits % 3 === 0) arcade.point("cargo", cargoHits);
    const points = Math.min(5, 1 + Math.floor(cargoStreak / 3));
    cargoScore += points;
    cargoStatus.textContent = "+" + points + (points === 1 ? " point." : " points.");
    byId("g-score").textContent = String(cargoScore);
    updateBest("g", cargoScore);
  } else {
    cargoStreak = 0;
    cargoDeadline -= 1000;
    cargoStatus.textContent = "Wrong bin. One second lost.";
    updateCargoClock();
  }
  byId("g-streak").textContent = String(cargoStreak);
  if (cargoActive) nextCrate();
}

byId("g-best").textContent = String(readBest("g"));
cargoStart.addEventListener("click", startCargo);
cargoOdd.addEventListener("click", () => sortCargo(true));
cargoEven.addEventListener("click", () => sortCargo(false));

document.addEventListener("keydown", (event) => {
  if (arcade.suspended || route !== "cargo" || !cargoActive || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  sortCargo(event.key === "ArrowLeft");
});
window.addEventListener("arcade:route", (event) => {
  if (event.detail !== "cargo" && cargoActive) finishCargo("Run ended. Final score " + cargoScore + ".");
});

if (arcade.demo) arcade.switchSolution = () => [...switchSolution];
window.addEventListener("arcade:route", e => { if(e.detail==="switchyard") newSwitchyard(); });

arcade.switchSolved=()=>puzzleSolved;
let cargoPausedAt=0;window.addEventListener("arcade:suspend",e=>{if(!cargoActive)return;if(e.detail)cargoPausedAt=performance.now();else if(cargoPausedAt){cargoDeadline+=performance.now()-cargoPausedAt;cargoPausedAt=0;}});
