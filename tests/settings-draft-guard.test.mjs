import test from "node:test";
import assert from "node:assert/strict";
import { settingsDraftStateModule } from "./helpers/production.mjs";

const { updateSettingsDraft, hasUnsavedSettingsDrafts } = settingsDraftStateModule;

test("close guard remains active until every visited settings draft is clean", () => {
  let drafts = new Set();
  assert.equal(hasUnsavedSettingsDrafts(drafts), false);

  drafts = updateSettingsDraft(drafts, "appearance", true);
  drafts = updateSettingsDraft(drafts, "profile", true);
  assert.equal(hasUnsavedSettingsDrafts(drafts), true);

  drafts = updateSettingsDraft(drafts, "appearance", false);
  assert.deepEqual([...drafts], ["profile"]);
  assert.equal(hasUnsavedSettingsDrafts(drafts), true);

  drafts = updateSettingsDraft(drafts, "profile", false);
  assert.equal(hasUnsavedSettingsDrafts(drafts), false);
});

test("draft state updates are immutable and repeated reports are idempotent", () => {
  const initial = new Set(["profile"]);
  const dirtyAgain = updateSettingsDraft(initial, "profile", true);
  const clean = updateSettingsDraft(dirtyAgain, "profile", false);

  assert.deepEqual([...initial], ["profile"]);
  assert.deepEqual([...dirtyAgain], ["profile"]);
  assert.equal(clean.size, 0);
});
