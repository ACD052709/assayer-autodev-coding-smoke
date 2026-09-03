function add(a, b) {
  return a - b;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { add };
}

if (typeof window !== "undefined") {
  window.add = add;
}
