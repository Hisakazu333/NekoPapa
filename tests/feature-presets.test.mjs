import assert from "node:assert/strict";
import test from "node:test";
import { featuresModule } from "./helpers/production.mjs";
import { WorkspaceStore, workspace, sampleState, storage } from "./helpers/workspace.mjs";
const { defaultPinnedFeatures, featureCatalog, maxPinnedFeatures, normalizePinnedFeatures } = featuresModule;

test("product presets exist in an empty workspace without becoming fake content or tabs", () => {
  const store = new WorkspaceStore(storage());
  assert.deepEqual(store.state.pinnedFeatures, defaultPinnedFeatures);
  assert.deepEqual(store.state.items, []);
  assert.deepEqual(store.state.groups, []);
  const snapshot = structuredClone(store.state);
  for (const feature of featureCatalog) assert.equal(store.open(feature.id), false);
  assert.deepEqual(store.state, snapshot);
});

test("pinning and unpinning persist only navigation preferences and preserve the current conversation", () => {
  const saved = storage(sampleState());
  const store = new WorkspaceStore(saved);
  store.open("today");
  const snapshot = structuredClone(store.state);
  assert.equal(store.toggleFeaturePin("memory"), true);
  assert.equal(store.toggleFeaturePin("characters"), true);
  const { pinnedFeatures, ...rest } = store.state;
  const { pinnedFeatures: previous, ...before } = snapshot;
  assert.deepEqual(rest, before);
  assert.deepEqual(pinnedFeatures, ["desktop-companion", "workflows", "characters"]);
  const loaded = new WorkspaceStore(saved);
  assert.deepEqual(loaded.state.pinnedFeatures, pinnedFeatures);
  assert.equal(loaded.state.activeId, "today");
});

test("removing all preset shortcuts stays empty after restart", () => {
  const saved = storage(sampleState());
  const store = new WorkspaceStore(saved);
  for (const id of [...store.state.pinnedFeatures]) assert.equal(store.toggleFeaturePin(id), true);
  assert.deepEqual(store.state.pinnedFeatures, []);
  assert.deepEqual(new WorkspaceStore(saved).state.pinnedFeatures, []);
});

test("the pin limit rejects extra shortcuts but always permits removing an existing one", () => {
  const store = workspace();
  assert.equal(store.toggleFeaturePin("characters"), true);
  assert.equal(store.state.pinnedFeatures.length, maxPinnedFeatures);
  assert.equal(store.toggleFeaturePin("schedules"), false);
  assert.equal(store.toggleFeaturePin("unknown"), false);
  assert.equal(store.toggleFeaturePin("memory"), true);
  assert.equal(store.toggleFeaturePin("schedules"), true);
  assert.equal(store.state.pinnedFeatures.length, maxPinnedFeatures);
});

test("legacy preferences gain defaults while duplicate or invalid pins are repaired independently of content", () => {
  const seed = sampleState();
  delete seed.pinnedFeatures;
  const old = new WorkspaceStore(storage(seed));
  assert.deepEqual(old.state.pinnedFeatures, defaultPinnedFeatures);
  assert.equal(old.state.items.length, seed.items.length);
  seed.pinnedFeatures = ["memory", "memory", "unknown", null, "characters", "schedules", "model-connections", "workflows"];
  const repaired = new WorkspaceStore(storage(seed));
  assert.deepEqual(repaired.state.pinnedFeatures, ["memory", "characters", "schedules", "model-connections"]);
  assert.equal(repaired.state.items.length, seed.items.length);
  assert.deepEqual(normalizePinnedFeatures([]), []);
});
