function encode16(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sealTarget(topic, clue, answer, proof) {
  const message = new TextEncoder().encode(JSON.stringify(["dial-v1", topic, clue, answer, proof]));
  const digest = await crypto.subtle.digest("SHA-256", message);
  return encode16(new Uint8Array(digest).slice(0, 16));
}
export function dialPoints(guess, answer) { return Math.max(0, 5 - Math.abs(guess - answer)); }

export async function createRound(topic, clue, answer) {
  const proof = encode16(crypto.getRandomValues(new Uint8Array(16)));
  const id = await sealTarget(topic, clue, answer, proof);
  return { round: { id, topic, clue }, secret: { answer, proof } };
}

// Only reveal links carry the secret. Clue and guess links carry its salted commitment.
export function roundParams(round, guess, secret) {
  const params = { t: round.topic, c: round.clue, id: round.id };
  if (guess !== undefined) params.g = guess;
  if (secret) { params.a = secret.answer; params.r = secret.proof; }
  return params;
}
