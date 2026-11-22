export const el = (id) => document.getElementById(id);

export function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}

export function button(label, className, action) {
  const item = node("button", label, className);
  item.type = "button";
  item.addEventListener("click", action);
  return item;
}

export function routeInfo(hash = location.hash) {
  const [name, query = ""] = hash.slice(1).split(/\?(.*)/s);
  return { name, params: new URLSearchParams(query) };
}

export function gameUrl(name, params = {}) {
  const url = new URL(location.pathname, location.origin);
  const query = new URLSearchParams(params).toString();
  url.hash = name + (query ? "?" + query : "");
  return url.href;
}

export function go(name, params = {}) {
  location.hash = new URL(gameUrl(name, params)).hash;
}

export function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export function parseSeed(value) {
  if (typeof value !== "string" || !/^[0-9a-z]{1,7}$/.test(value)) return null;
  const number = parseInt(value, 36);
  return number <= 0xffffffff ? number : null;
}

export function randomStream(seed) {
  return {
    state: seed >>> 0,
    next() {
      this.state = (this.state + 0x6d2b79f5) >>> 0;
      let bits = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
      bits ^= bits + Math.imul(bits ^ (bits >>> 7), 61 | bits);
      return ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
    },
    pick(items) { return items[Math.floor(this.next() * items.length)]; },
    shuffle(items) {
      const result = [...items];
      for (let end = result.length - 1; end > 0; end--) {
        const index = Math.floor(this.next() * (end + 1));
        [result[index], result[end]] = [result[end], result[index]];
      }
      return result;
    }
  };
}

const cache = new Map();
export function readData(key, fallback = null) {
  if (globalThis.arcade?.demo) return cache.get(key) ?? fallback;
  if (cache.has(key)) return cache.get(key);
  try {
    const raw = localStorage.getItem("minute-arcade-" + key);
    if (raw !== null) return JSON.parse(raw);
  } catch {}
  return fallback;
}

export function saveData(key, value) {
  if(globalThis.arcade?.demo){cache.set(key,value);return true;}
  try {
    localStorage.setItem("minute-arcade-" + key, JSON.stringify(value));
    cache.delete(key);
    return true;
  } catch { cache.set(key, value); return false; }
}

export function readEntry(key, id) {
  const list = readData(key, []);
  return Array.isArray(list) ? list.find((entry) => entry.id === id)?.data : undefined;
}

export function saveEntry(key, id, data, limit = 40) {
  const list = readData(key, []);
  const others = Array.isArray(list) ? list.filter((entry) => entry.id !== id) : [];
  return saveData(key, [{ id, data }, ...others].slice(0, limit));
}

export function shareControls(host, details, label = "Share challenge") {
  const row = node("div", undefined, "share-buttons");
  const status = node("span", "", "share-note");
  status.setAttribute("role", "status");
  const field = node("input", undefined, "link-field");
  field.type = "url";
  field.readOnly = true;
  field.hidden = true;
  field.setAttribute("aria-label", "Link to copy into a message");
  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = "Link copied. Paste it into a text.";
    } catch {
      field.value = url;
      field.hidden = false;
      field.focus();
      field.select();
      status.textContent = "Copy the selected link into a message.";
    }
  }
  async function act(useShare) {
    const { title, text, url } = details();
    status.textContent = "";
    field.hidden = true;
    if (useShare && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    await copy(url);
  }
  row.append(button(label, "button share-primary", () => act(true)), button("Copy link", "copy-link", () => act(false)));
  host.replaceChildren(row, status, field);
}
