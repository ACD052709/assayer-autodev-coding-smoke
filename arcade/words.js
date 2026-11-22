import { el, node, button, parseSeed, randomSeed, go, gameUrl, shareControls, readEntry, saveEntry } from "./core.js";
import { words, differences, themes, makeLadder, makeThread, dailyEdition } from "./puzzles.js";

let seed, ladder, liftState, puzzle, threadState;
let liftKey, threadKey;

function rungTiles(word, prior, changedOnly = false) {
  const row = node("span", undefined, "letter-tiles");
  for (let index = 0; index < 4; index++) {
    const visible = !changedOnly || (prior && word[index] !== prior[index]);
    row.append(node("b", visible ? word[index].toUpperCase() : "·", visible && prior && word[index] !== prior[index] ? "changed" : ""));
  }
  return row;
}

function drawLadder(message) {
  const current = liftState.step;
  const finished = current === ladder.length - 1;
  const list = el("l-ladder");
  list.replaceChildren();
  ladder.forEach((word, index) => {
    const item = node("li");
    const shown = index === 0 || index < current || index === ladder.length - 1;
    if (index === current && !finished) item.className = "on-rung";
    const tag = index === 0 ? "Start" : index === ladder.length - 1 ? "Goal" : "Rung " + index;
    item.append(node("span", tag, "rung-label"));
    if (shown) item.append(rungTiles(word, index > 0 && index < current ? ladder[index - 1] : null));
    else if (index === current && liftState.hints.includes(index)) item.append(rungTiles(word, ladder[index - 1], true));
    else item.append(rungTiles("····"));
    list.append(item);
  });
  el("l-form").hidden = finished;
  el("l-hint").hidden = finished;
  el("l-hint").disabled = liftState.hints.includes(current);
  if (!finished) el("l-clue").textContent = "Rung " + current + " · " + words.get(ladder[current]);
  el("l-status").textContent = finished
    ? "Ladder complete! " + liftState.hints.length + (liftState.hints.length === 1 ? " hint" : " hints") + " and " + liftState.misses + (liftState.misses === 1 ? " miss." : " misses.")
    : message || (liftState.hints.includes(current) ? "The highlighted letter is in its correct position." : "Enter the next four-letter word.");
}

el("l-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!ladder || liftState.step === ladder.length - 1) return;
  const field = el("l-answer");
  const guess = field.value.trim().toLowerCase();
  if (!/^[a-z]{4}$/.test(guess)) { field.setAttribute("aria-invalid","true"); drawLadder("This rung needs exactly four letters. You entered " + guess.length + "."); return; }
  const correct = guess === ladder[liftState.step];
  const previous=ladder[liftState.step-1];
  field.setAttribute("aria-invalid",String(!correct));
  if (correct) {
    arcade.point("letterlift",liftState.step,liftKey);
    liftState.step++;
    field.value = "";
  } else {
    liftState.misses++;
    field.select();
  }
  saveEntry("letterlift-progress-v1", liftKey, liftState);
  const changed=differences(previous,guess);
  let feedback="That fits. On to the next rung.";
  if(!correct){
    if(!changed) feedback=guess.toUpperCase()+" repeats the previous word. Change exactly one letter.";
    else if(changed>1) feedback=guess.toUpperCase()+" changes "+changed+" letters from "+previous.toUpperCase()+". Keep three letters in place.";
    else feedback=guess.toUpperCase()+" changes one letter correctly. The clue asks for “"+words.get(ladder[liftState.step])+"”.";
    arcade.tone("miss");
  }
  drawLadder(feedback);
  if (liftState.step < ladder.length - 1) field.focus({ preventScroll: true });
});

el("l-hint").addEventListener("click", () => {
  if (liftState.step >= ladder.length - 1 || liftState.hints.includes(liftState.step)) return;
  liftState.hints.push(liftState.step);
  saveEntry("letterlift-progress-v1", liftKey, liftState);
  drawLadder();
});

function drawThread(message = "") {
  const { shown, wrong, result } = threadState;
  const list = el("t-clues");
  list.replaceChildren();
  puzzle.clues.forEach((clue, index) => {
    const revealed = index < shown || Boolean(result);
    const item = node("li", undefined, revealed ? "visible-clue" : "covered-clue");
    item.append(node("span", String(index + 1), "clue-index"), node("b", revealed ? clue : "Hidden clue"));
    list.append(item);
  });
  el("t-choices").replaceChildren(...puzzle.options.map((option) => {
    const chosenWrong = wrong.includes(option);
    const right = result && option === puzzle.title;
    const choice = button(option + (chosenWrong ? " ×" : right ? " ✓" : ""), "choice" + (chosenWrong ? " tried" : right ? " correct" : ""), () => guessThread(option));
    choice.disabled = Boolean(result) || chosenWrong;
    return choice;
  }));
  el("t-next").hidden = Boolean(result) || shown === 5;
  if (result === "won") {
    const score = 6 - shown;
    el("t-status").textContent = puzzle.title + "! Solved in " + shown + (shown === 1 ? " clue" : " clues") + " for " + score + (score === 1 ? " point." : " points.");
  } else if (result === "lost") {
    el("t-status").textContent = "The connection was “" + puzzle.title + "”.";
  } else {
    el("t-status").textContent = message || "Clue " + shown + " of 5. Three wrong guesses end the puzzle.";
  }
}

function guessThread(option) {
  if (threadState.result || threadState.wrong.includes(option)) return;
  if (option === puzzle.title) { threadState.result = "won"; arcade.point("thread","solve",threadKey,"win"); }
  else {
    threadState.wrong.push(option);
    if (threadState.wrong.length === 3) threadState.result = "lost";
    else threadState.shown = Math.min(5, threadState.shown + 1);
  }
  saveEntry("thread-progress-v1", threadKey, threadState);
  drawThread("That connection didn’t fit. " + (3 - threadState.wrong.length) + (threadState.wrong.length === 2 ? " guess left." : " guesses left."));
}

el("t-next").addEventListener("click", () => {
  if (threadState.result || threadState.shown >= 5) return;
  threadState.shown++;
  saveEntry("thread-progress-v1", threadKey, threadState);
  drawThread();
});

function nextPractice(name) {
  let next = randomSeed();
  if (next === seed) next = (next + 1) >>> 0;
  const params = { s: next.toString(36), k: "p" };
  if (name === "thread") {
    const choices = themes.filter((theme) => theme.id !== puzzle.id);
    params.p = choices[next % choices.length].id;
  }
  go(name, params);
}
el("t-practice").addEventListener("click", () => nextPractice("thread"));
el("l-practice").addEventListener("click", () => nextPractice("letterlift"));

function friendFootnote(name, params) {
  if (params.get("k") !== "c") return "";
  if (name === "letterlift") {
    const hints = params.get("h"), misses = params.get("x");
    return /^[0-5]$/.test(hints || "") && /^\d{1,5}$/.test(misses || "") ? " · Your friend used " + hints + " hints and had " + misses + " misses" : " · Friend challenge";
  }
  const used = params.get("n");
  return /^[1-5]$/.test(used || "") ? " · Your friend solved it in " + used + (used === "1" ? " clue" : " clues") : " · Friend challenge";
}

export function wordRoute(name, params) {
  if (name !== "letterlift" && name !== "thread") return;
  const today = dailyEdition();
  const fromLink = parseSeed(params.get("s"));
  seed = fromLink ?? today.seed;
  const isLift = name === "letterlift";
  if (!isLift) puzzle = makeThread(seed, fromLink === null ? today.theme : params.get("p"));
  const daily = seed === today.seed && (isLift || puzzle.id === today.theme);
  const prefix = isLift ? "l" : "t";
  el(prefix + "-edition").textContent = (daily ? "Daily puzzle · " + today.date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) + " UTC" : params.get("k") === "c" ? "Shared puzzle" : "Practice puzzle") + friendFootnote(name, params);
  el(prefix + "-daily").hidden = daily;
  el(prefix + "-practice").textContent = daily ? "Practice puzzle" : "Another practice puzzle";
  if (isLift) {
    ladder = makeLadder(seed);
    liftKey = seed.toString(36);
    const saved = readEntry("letterlift-progress-v1", liftKey);
    liftState = saved && Number.isInteger(saved.step) && saved.step > 0 && saved.step < ladder.length && Array.isArray(saved.hints) && Number.isInteger(saved.misses)
      ? saved : { step: 1, hints: [], misses: 0 };
    el("l-answer").value = ""; el("l-answer").removeAttribute("aria-invalid");
    drawLadder();
    shareControls(el("l-share"), () => {
      const done = liftState.step === ladder.length - 1;
      const q = { s: liftKey, k: "c" };
      if (done) { q.h = liftState.hints.length; q.x = liftState.misses; }
      return { title: "Letterlift · Minute Arcade", text: done ? "I finished this ladder with " + q.h + " hints and " + q.x + " misses. Your turn!" : "Climb this word ladder with me.", url: gameUrl(name, q) };
    });
  } else {
    threadKey = puzzle.id + "." + seed.toString(36);
    const saved = readEntry("thread-progress-v1", threadKey);
    threadState = saved && Number.isInteger(saved.shown) && saved.shown >= 1 && saved.shown <= 5 && Array.isArray(saved.wrong) && ["", "won", "lost"].includes(saved.result)
      ? saved : { shown: 1, wrong: [], result: "" };
    drawThread();
    shareControls(el("t-share"), () => {
      const q = { s: seed.toString(36), p: puzzle.id, k: "c" };
      if (threadState.result === "won") q.n = threadState.shown;
      return { title: "Common Thread · Minute Arcade", text: q.n ? "I spotted the connection in " + q.n + (q.n === 1 ? " clue. Your turn!" : " clues. Your turn!") : "Can you spot the connection?", url: gameUrl(name, q) };
    });
  }
}

el("l-answer").addEventListener("input",()=>el("l-answer").removeAttribute("aria-invalid"));
if(arcade.demo) arcade.demoWords=()=>({answer:ladder?.[liftState?.step],connection:puzzle?.title});
