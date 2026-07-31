import "@testing-library/jest-dom/vitest";

// jsdom implements neither of these. Both are fire-and-forget in the app, so a
// no-op keeps component tests from failing on the environment rather than the code.
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView ??= () => {};
}
if (typeof HTMLMediaElement !== "undefined") {
  HTMLMediaElement.prototype.play ??= () => Promise.resolve();
}
