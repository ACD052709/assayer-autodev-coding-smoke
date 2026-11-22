import { el, node, button, randomSeed, gameUrl, go, shareControls, readEntry, saveEntry } from "./core.js";

import { createRound, roundParams, sealTarget, dialPoints } from "./relay.js";

const scales = [
  ["Weekend plan", "Very quiet", "Action packed"],
  ["Snack", "Familiar", "Adventurous"],
  ["Animal", "Cuddly", "Terrifying"],
  ["Movie scene", "Calm", "Chaotic"],
  ["Sound", "Barely audible", "Thunderous"],
  ["Job", "Predictable", "Unpredictable"],
  ["Gift", "Practical", "Whimsical"],
  ["Journey", "Effortless", "Grueling"],
  ["Outfit", "Understated", "Over the top"],
  ["Superpower", "Tiny perk", "World changing"],
  ["Place to sleep", "Uncomfortable", "Luxurious"],
  ["Party trick", "Easy to learn", "Takes years"]
];
const storageKey = "dial-secrets-v1";
const tokenPattern = /^[a-zA-Z0-9_-]{22}$/;
let screen = 0;
const content = el("w-content");
const status = el("w-status");

function needle(value) {
  el("w-stage").classList.toggle("unknown", value === null);
  el("w-needle").style.setProperty("--angle", ((value === null ? 5.5 : value) - 1) * 16 - 72 + "deg");
}
function fieldLabel(text, input) {
  const label = node("label", text);
  label.htmlFor = input.id;
  return label;
}
function numberInRange(raw) { return /^(?:[1-9]|10)$/.test(raw || "") ? Number(raw) : null; }
function topicNumber(raw) {
  return /^\d{1,2}$/.test(raw || "") && Number(raw) < scales.length ? Number(raw) : null;
}
function normalized(text) {
  return String(text || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ");
}
function scaleLine(topic) {
  const [, low, high] = scales[topic];
  const line = node("div", undefined, "scale-line");
  line.append(node("span", "1 · " + low), node("span", "10 · " + high));
  return line;
}
function newRoundButton(label = "Make a new clue") {
  return button(label, "button outline", () => {
    if (location.hash === "#dial") compose(randomSeed() % scales.length);
    else go("dial");
  });
}
function shareBox(label, text, params) {
  const host = node("div", undefined, "share-slot");
  shareControls(host, () => ({ title: "Dial Relay · Minute Arcade", text, url: gameUrl("dial", params) }), label);
  return host;
}

function compose(topic, invited = false) {
  const ticket = ++screen;
  const target = arcade.demo ? 8 : 1 + randomSeed() % 10;
  needle(target);
  content.replaceChildren(node("h2", invited ? "Your friend picked a scale" : "Write a clue"));
  status.textContent = "";
  const form = node("form", undefined, "relay-form");
  const select = node("select");
  select.id = "dial-topic";
  scales.forEach(([title], index) => {
    const opt = node("option", title);
    opt.value = String(index);
    select.append(opt);
  });
  select.value = String(topic);
  const range = scaleLine(topic);
  const targetLine = node("div", undefined, "secret-card");
  targetLine.append(node("span", "Your secret number"), node("strong", String(target)));
  const input = node("input");
  input.id = "dial-clue";
  input.type = "text";
  input.maxLength = 80;
  input.required = true;
  input.autocomplete = "off";
  input.placeholder = "One example that fits your number";
  const submit = node("button", "Seal my clue", "button apricot");
  submit.type = "submit";
  form.append(fieldLabel("Pick a scale", select), select, range, targetLine, fieldLabel("Your clue", input), input, submit);
  select.addEventListener("change", () => {
    topic = Number(select.value);
    range.replaceChildren(...scaleLine(topic).childNodes);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const clue = normalized(input.value);
    if (!clue) { status.textContent = "Enter a clue for your friend."; input.focus(); return; }
    const chosenTopic = Number(select.value);
    submit.disabled = true;
    try {
      const { round, secret } = await createRound(chosenTopic, clue, target);
      if (screen !== ticket) return;
      const stored = saveEntry(storageKey, round.id, secret, 60);
      sealed(round, stored);
    } catch {
      if (screen === ticket) { submit.disabled = false; status.textContent = "This browser could not seal the clue. Open the game in a current browser and try again."; }
    }
  });
  content.append(form);
  if (!invited) {
    const request = node("details", undefined, "topic-invite");
    request.append(node("summary", "Want to guess first?"));
    const invite = node("div", undefined, "share-slot");
    shareControls(invite, () => ({ title: "Pick a clue for me", text: "I picked a scale. Give me a clue in Dial Relay!", url: gameUrl("dial", { t: select.value }) }), "Send this scale");
    request.append(node("p", "Choose a scale above and send it to a friend. They’ll write the clue."), invite);
    content.append(request);
  }
}

function sealed(round, saved) {
  needle(null);
  content.replaceChildren(node("h2", "Clue sealed"), node("blockquote", round.clue), scaleLine(round.topic));
  const params = roundParams(round);
  content.append(node("p", saved ? "Text the clue to a friend. Open their reply in this browser to reveal the number." : "This browser can keep the answer only in this open tab. Use “Pass this phone” to finish here."),
    shareBox("Share clue", "Where does my clue land on the dial?", params),
    button("Pass this phone", "button outline", () => go("dial", params)), newRoundButton());
  status.textContent = "";
}

function showGuess(round) {
  needle(null);
  const previous = readEntry("dial-guesses-v1", round.id);
  if (numberInRange(String(previous))) { locked(round, previous); return; }
  content.replaceChildren(node("h2", "Guess the number"), node("p", "The scale is “" + scales[round.topic][0] + "”. Your friend’s clue is"), node("blockquote", round.clue), scaleLine(round.topic));
  const choices = node("div", undefined, "guess-grid");
  choices.setAttribute("role", "group");
  choices.setAttribute("aria-label", "Pick a number from 1 to 10");
  let guess = null;
  const commit = button("Lock in my guess", "button apricot", () => {
    if (guess === null) return;
    saveEntry("dial-guesses-v1", round.id, guess, 60);
    locked(round, guess);
  });
  commit.disabled = true;
  for (let i = 1; i <= 10; i++) {
    const pick = button(String(i), "choice", () => {
      guess = i;
      needle(i);
      for (const option of choices.children) option.setAttribute("aria-pressed", String(option === pick));
      commit.disabled = false;
    });
    pick.setAttribute("aria-pressed", "false");
    choices.append(pick);
  }
  content.append(choices, commit);
}

function locked(round, guess) {
  needle(guess);
  const params = roundParams(round, guess);
  const own = readEntry(storageKey, round.id);
  content.replaceChildren(node("h2", "Guess locked · " + guess), node("blockquote", round.clue));
  if (own) {
    content.append(button("Reveal together", "button apricot", () => go("dial", params)));
  } else {
    content.append(node("p", "Send your guess back to the clue giver. They can now reveal the number and share your score."), shareBox("Share my guess", "I locked in " + guess + ". What was the secret number?", params));
  }
  status.textContent = "";
}

function badRound(text = "This round link is incomplete. Open the full link from the message or start a fresh round.") {
  needle(null);
  content.replaceChildren(node("h2", "Round unavailable"), node("p", text), newRoundButton());
  status.textContent = "";
}

async function reveal(round, guess, answer, proof, ticket) {
  if (!answer || !tokenPattern.test(proof || "")) return badRound();
  const valid = await sealTarget(round.topic, round.clue, answer, proof);
  if (screen !== ticket) return;
  if (valid !== round.id) return badRound("The reveal does not match the original sealed clue.");
  const score = dialPoints(guess, answer);
  if (readEntry(storageKey,round.id) || readEntry("dial-guesses-v1",round.id)) arcade.point("dial","reveal",round.id,"win");
  needle(answer);
  content.replaceChildren(node("h2", score === 5 ? "Exact match!" : "Round revealed"), node("blockquote", round.clue), scaleLine(round.topic));
  const result = node("div", undefined, "relay-result");
  for (const [label, value] of [["Guess", guess], ["Secret", answer], ["Points", score + "/5"]]) {
    const cell = node("div"); cell.append(node("span", label), node("strong", String(value))); result.append(cell);
  }
  const params = roundParams(round, guess, { answer, proof });
  content.append(result, shareBox("Share the reveal", "Our Dial Relay round is in. We scored " + score + "/5!", params), newRoundButton("Switch roles · Give a clue"));
  status.textContent = "";
}

export function dialRoute(name, params) {
  const ticket = ++screen;
  if (name !== "dial") return;
  status.textContent = "";
  const topic = topicNumber(params.get("t"));
  if (!params.has("id") && !params.has("c") && !params.has("g") && !params.has("a") && !params.has("r")) {
    compose(topic ?? (randomSeed() % scales.length), topic !== null);
    return;
  }
  const round = { topic, id: params.get("id") || "", clue: normalized(params.get("c")) };
  if (topic === null || !round.clue || round.clue.length > 80 || !tokenPattern.test(round.id)) return badRound();
  if (!params.has("g") && !params.has("a") && !params.has("r")) return showGuess(round);
  const guess = numberInRange(params.get("g"));
  if (guess === null) return badRound();
  const published = params.has("a") || params.has("r");
  const secret = published ? { answer: numberInRange(params.get("a")), proof: params.get("r") } : readEntry(storageKey, round.id);
  if (!secret) {
    locked(round, guess);
    status.textContent = "The clue giver’s original browser holds the secret.";
    return;
  }
  needle(null);
  content.replaceChildren(node("h2", "Opening the reveal…"));
  reveal(round, guess, secret.answer, secret.proof, ticket).catch(() => {
    if (ticket === screen) badRound("This browser could not verify the reveal. Open the link in a current browser.");
  });
}
