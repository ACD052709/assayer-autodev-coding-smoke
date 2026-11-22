import { randomStream } from "./core.js";

export const columnCount = 5;
export const columnHeight = 6;

function queueTile(run) {
  const random = randomStream(run.randomState);
  const roll = random.next();
  run.randomState = random.state;
  // The bag rises by drop count so friends get identical tiles even if they play differently.
  const drawn = run.drawn ?? (run.drops + 2);
  run.drawn = drawn + 1;
  const base = 1 + Math.floor(Math.log2(1 + Math.max(0, drawn - 2) / 96));
  return base + (roll < 0.63 ? 0 : roll < 0.94 ? 1 : 2);
}

export function createMerge(seed) {
  const run = { seed, randomState: seed, columns: Array.from({ length: columnCount }, () => []), score: 0, drops: 0, drawn: 0, held: 0, holdUsed: false, longest: 0 };
  run.current = queueTile(run);
  run.next = queueTile(run);
  return run;
}

export function validMerge(run) {
  return Boolean(run && [run.seed, run.randomState].every((v) => Number.isInteger(v) && v >= 0 && v <= 0xffffffff)
    && [run.score, run.drops].every((v) => Number.isSafeInteger(v) && v >= 0)
    && [run.current, run.next].every(validRank)
    && Array.isArray(run.columns) && run.columns.length === columnCount
    && run.columns.every((column) => Array.isArray(column) && column.length <= columnHeight && column.every(validRank)));
}

function validRank(n) { return Number.isInteger(n) && n >= 1 && n <= 1024; }

export function tileLabel(rank) {
  return rank < 14 ? String(2 ** rank) : "2^" + rank;
}

export function mergeFull(run) { return run.columns.every((column) => column.length === columnHeight); }

export function holdTile(run) {
  if (run.holdUsed || mergeFull(run)) return false;
  const old = run.held || 0;
  run.held = run.current;
  run.current = old || run.next;
  if (!old) run.next = queueTile(run);
  run.holdUsed = true;
  return true;
}
export function dropTile(run, lane) {
  const column = run.columns[lane];
  if (!column || column.length >= columnHeight) return null;
  column.push(run.current);
  let chain = 0;
  let gain = 0;
  for (;;) {
    const row = column.length - 1;
    const rank = column[row];
    // Resolve below first, then left and right. The newest tile stays in its column.
    const neighbors = [[lane, row - 1], [lane - 1, row], [lane + 1, row]];
    const match = neighbors.find(([x, y]) => y >= 0 && run.columns[x]?.[y] === rank);
    if (!match) break;
    const [x, y] = match;
    run.columns[x].splice(y, 1);
    column[column.length - 1] = rank + 1;
    chain++;
    gain += (2 ** Math.min(36, rank + 1)) * chain;
  }
  run.score = Math.min(Number.MAX_SAFE_INTEGER, run.score + gain);
  run.drops++;
  run.holdUsed = false;
  run.longest = Math.max(run.longest || 0, chain);
  run.current = run.next;
  run.next = queueTile(run);
  return { chain, gain, row: column.length - 1 };
}

export function createCourse(seed) {
  const random = randomStream(seed);
  let safe = 2;
  let count = 0;
  return function nextGate() {
    const neighbors = [safe - 1, safe, safe + 1].filter((lane) => lane >= 0 && lane < columnCount);
    safe = random.pick(neighbors);
    const openings = [safe];
    // Early gates always give the player two routes. Later gates mix single and double openings.
    if (count < 4 || random.next() < 0.62) {
      const others = [0, 1, 2, 3, 4].filter((lane) => lane !== safe);
      openings.push(random.pick(others));
    }
    const gold = openings.length === 2 ? openings[1] : safe;
    count++;
    return { openings, gold, safe };
  };
}

export const gateSpacing = 120;
export const playerY = 279;
export function createDodge(seed) {
  const nextGate = createCourse(seed);
  const run = { seed, nextGate, gates: [], lane: 2, position: 2, distance: 0, elapsed: 0, cleared: 0, shards: 0, score: 0, crashed: false };
  for (let i = 0; i < 4; i++) run.gates.push({ ...nextGate(), y: 22 - i * gateSpacing });
  return run;
}

export function speedMultiplier(seconds) {
  if (seconds <= 15) return 1 + Math.max(0, seconds) * .25 / 15;
  if (seconds <= 315) return 1.25 + (seconds - 15) * .15 / 300;
  return 1.4 * Math.pow(1.02, (seconds - 315) / 60);
}
export function advanceDodge(run, dt) {
  if (run.crashed) return;
  run.elapsed += dt;
  const original = 106 + 100 * (1 - Math.exp(-run.cleared / 36)) + 5 * Math.log1p(run.cleared / 30);
  const speed = original * speedMultiplier(run.elapsed);
  const step = dt * 9;
  run.position += Math.sign(run.lane - run.position) * Math.min(step, Math.abs(run.lane - run.position));
  run.distance += speed * dt;
  run.gates.forEach((gate) => { gate.y += speed * dt; });
  const first = run.gates.find((gate) => !gate.passed);
  if (first && first.y >= playerY) {
    // The entire ship must fit in an opening when its center crosses the gate.
    const across = [Math.floor(run.position + 0.5 - 0.13), Math.floor(run.position + 0.5 + 0.13)];
    if (!across.every((lane) => first.openings.includes(lane))) {
      run.crashed = true;
      return;
    }
    first.passed = true;
    run.cleared++;
    if (Math.abs(run.position - first.gold) < 0.34) run.shards++;
    run.score = run.cleared + run.shards * 2;
  }
  if (run.gates[0].y > 365) {
    run.gates.shift();
    run.gates.push({ ...run.nextGate(), y: run.gates.at(-1).y - gateSpacing });
  }
}
