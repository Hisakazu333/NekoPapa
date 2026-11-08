import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-theme-transition-"));
let revealTheme;
try {
  execFileSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./theme-transition-tsconfig.json", import.meta.url)),
    "--outDir", output,
  ]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  ({ revealTheme } = await import(pathToFileURL(join(output, "platform/theme-transition.js"))));
} finally {
  rmSync(output, { recursive: true, force: true });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function browser(t, { supported = true, reducedMotion = false, startError } = {}) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const classes = new Set();
  const styles = new Set();
  const captures = [];
  const document = {
    documentElement: {
      classList: {
        add: (value) => classes.add(value),
        remove: (value) => classes.delete(value),
      },
    },
    head: { appendChild: (style) => styles.add(style) },
    getElementById: (id) => [...styles].find((style) => style.id === id),
    createElement: (tag) => {
      assert.equal(tag, "style");
      const style = { id: "", textContent: "", remove: () => styles.delete(style) };
      return style;
    },
  };
  if (supported) {
    document.startViewTransition = (update) => {
      if (startError) throw startError;
      const ready = deferred();
      const finished = deferred();
      const capture = {
        update, ready, finished, skipped: false,
        transition: {
          ready: ready.promise,
          finished: finished.promise,
          // Skipping presentation still lets the browser invoke its queued update.
          skipTransition: () => {
            capture.skipped = true;
            ready.reject(new Error("AbortError: transition skipped"));
          },
        },
      };
      captures.push(capture);
      return capture.transition;
    };
  }
  globalThis.document = document;
  globalThis.window = {
    innerWidth: 1000,
    innerHeight: 800,
    matchMedia: (query) => {
      assert.equal(query, "(prefers-reduced-motion: reduce)");
      return { matches: reducedMotion };
    },
  };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  return { classes, styles, captures };
}

function finish(capture) {
  capture.update();
  capture.ready.resolve();
  capture.finished.resolve();
}

for (const [name, browserOptions, revealOptions] of [
  ["initial application", {}, { animate: false }],
  ["unsupported browser", { supported: false }, {}],
  ["reduced motion", { reducedMotion: true }, {}],
]) {
  test(`${name} applies immediately without a capture or temporary overlay`, async (t) => {
    const fake = browser(t, browserOptions);
    const updates = [];
    await revealTheme(() => updates.push("dark"), revealOptions);
    assert.deepEqual(updates, ["dark"]);
    assert.equal(fake.captures.length, 0);
    assert.equal(fake.styles.size, 0);
    assert.equal(fake.classes.has("theme-transitioning"), false);
  });
}

test("animated capture uses the clamped interaction origin and cleans its styles", async (t) => {
  const fake = browser(t);
  let updates = 0;
  const pending = revealTheme(() => updates++, { origin: { x: 1200, y: -30 }, duration: 400 });
  assert.equal(fake.classes.has("theme-transitioning"), true);
  assert.equal(updates, 0);
  const [style] = fake.styles;
  assert.match(style.textContent, /transform-origin: 1000px 0px/);
  assert.match(style.textContent, /boardui-theme-mask-reveal 400ms/);
  finish(fake.captures[0]);
  await pending;
  assert.equal(updates, 1);
  assert.equal(fake.styles.size, 0);
  assert.equal(fake.classes.has("theme-transitioning"), false);
});

test("keyboard activation reveals from the focused element center", async (t) => {
  const fake = browser(t);
  const pending = revealTheme(() => {}, {
    element: { getBoundingClientRect: () => ({ left: 40, top: 700, width: 28, height: 28 }) },
  });
  assert.match([...fake.styles][0].textContent, /transform-origin: 54px 714px/);
  finish(fake.captures[0]);
  await pending;
});

test("rapid choices skip old captures and stale callbacks cannot overwrite the latest theme", async (t) => {
  const fake = browser(t);
  const updates = [];
  const first = revealTheme(() => updates.push("dark"));
  const oldCapture = fake.captures[0];
  const oldStyle = [...fake.styles][0];
  const second = revealTheme(() => updates.push("light"));
  const latestCapture = fake.captures[1];
  const latestStyle = [...fake.styles][0];
  assert.equal(oldCapture.skipped, true);
  assert.notEqual(oldStyle, latestStyle);
  finish(oldCapture);
  await first;
  assert.deepEqual(updates, []);
  assert.equal(fake.styles.has(latestStyle), true);
  assert.equal(fake.classes.has("theme-transitioning"), true);
  finish(latestCapture);
  await second;
  oldCapture.update();
  assert.deepEqual(updates, ["light"]);
  assert.equal(fake.styles.size, 0);
  assert.equal(fake.classes.has("theme-transitioning"), false);
});

test("an old animation failure cannot clean up or reapply over a newer capture", async (t) => {
  const fake = browser(t);
  const updates = [];
  const first = revealTheme(() => updates.push("dark"));
  const oldCapture = fake.captures[0];
  oldCapture.update();
  oldCapture.ready.resolve();
  await Promise.resolve();
  const second = revealTheme(() => updates.push("light"));
  const latestCapture = fake.captures[1];
  const latestStyle = [...fake.styles][0];
  oldCapture.finished.reject(new Error("AbortError: replaced animation"));
  await first;
  assert.deepEqual(updates, ["dark"]);
  assert.equal(fake.styles.has(latestStyle), true);
  assert.equal(fake.classes.has("theme-transitioning"), true);
  finish(latestCapture);
  await second;
  assert.deepEqual(updates, ["dark", "light"]);
  assert.equal(fake.styles.size, 0);
  assert.equal(fake.classes.has("theme-transitioning"), false);
});

test("a newer immediate choice also invalidates a delayed animated update", async (t) => {
  const fake = browser(t);
  const updates = [];
  const animated = revealTheme(() => updates.push("dark"));
  await revealTheme(() => updates.push("light"), { animate: false });
  finish(fake.captures[0]);
  await animated;
  assert.deepEqual(updates, ["light"]);
  assert.equal(fake.captures[0].skipped, true);
  assert.equal(fake.styles.size, 0);
  assert.equal(fake.classes.has("theme-transitioning"), false);
});

test("capture rejection applies the latest update once even if the browser invokes it afterward", async (t) => {
  const fake = browser(t);
  let updates = 0;
  const pending = revealTheme(() => updates++);
  const [capture] = fake.captures;
  capture.ready.reject(new Error("InvalidStateError: capture unavailable"));
  await pending;
  capture.update();
  capture.finished.resolve();
  assert.equal(updates, 1);
  assert.equal(fake.styles.size, 0);
  assert.equal(fake.classes.has("theme-transitioning"), false);
});

test("animation rejection after an applied update does not apply it twice", async (t) => {
  const fake = browser(t);
  let updates = 0;
  const pending = revealTheme(() => updates++);
  const [capture] = fake.captures;
  capture.update();
  capture.ready.resolve();
  await Promise.resolve();
  capture.finished.reject(new Error("AbortError: animation interrupted"));
  await pending;
  assert.equal(updates, 1);
  assert.equal(fake.styles.size, 0);
  assert.equal(fake.classes.has("theme-transitioning"), false);
});

test("synchronous browser capture failure still applies and cleans the latest choice", async (t) => {
  const fake = browser(t, { startError: new Error("InvalidStateError") });
  let updates = 0;
  await revealTheme(() => updates++);
  assert.equal(updates, 1);
  assert.equal(fake.styles.size, 0);
  assert.equal(fake.classes.has("theme-transitioning"), false);
});
