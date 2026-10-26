import assert from "node:assert/strict";
import test from "node:test";
import { createLivePresentations } from "../src/live-presentations.js";

test("retained and copied contexts see complete replacement designs without mutating old snapshots", () => {
  const old = { mode: "EMBED", embeds: [{ title: "Old" }] };
  const state = createLivePresentations({ panel: old, removed_slot: old });
  const retained = state.value;
  const copy = { ...{ presentations: retained } };
  const next = { panel: { mode: "COMPONENTS_V2", components: [{ type: 10, content: "New" }] }, added_slot: {} };
  state.update(next);
  assert.equal(copy.presentations, retained);
  assert.deepEqual(retained.panel, next.panel);
  assert.equal(retained.removed_slot, undefined);
  assert.equal("removed_slot" in retained, false);
  assert.deepEqual(Object.keys(retained), ["panel", "added_slot"]);
  assert.deepEqual({ ...retained }, next);
  assert.equal(JSON.stringify(retained), JSON.stringify(next));
  assert.equal(old.mode, "EMBED");
});

test("features cannot mutate the shared presentation view", () => {
  const state = createLivePresentations({ panel: { mode: "EMBED" } });
  assert.equal(Reflect.set(state.value, "panel", {}), false);
  assert.equal(Reflect.deleteProperty(state.value, "panel"), false);
  assert.equal(Reflect.defineProperty(state.value, "panel", { value: {} }), false);
  assert.equal(Reflect.setPrototypeOf(state.value, {}), false);
  assert.equal(Reflect.preventExtensions(state.value), false);
  assert.deepEqual(state.value.panel, { mode: "EMBED" });
  state.update({});
  assert.deepEqual(Object.keys(state.value), []);
});
