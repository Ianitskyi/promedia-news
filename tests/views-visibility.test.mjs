import test from "node:test";
import assert from "node:assert/strict";
import { viewsVisible } from "../src/lib/render.js";

const now = Date.parse("2026-11-17T12:00:00.000Z");

test("view counter stays hidden during the first 24 hours", () => {
  assert.equal(viewsVisible("2026-11-17T08:00:00.000Z", now), false);
  assert.equal(viewsVisible("2026-11-16T12:00:01.000Z", now), false);
});

test("view counter appears once 24 hours have passed", () => {
  assert.equal(viewsVisible("2026-11-16T12:00:00.000Z", now), true);
  assert.equal(viewsVisible("2026-10-01T09:00:00.000Z", now), true);
});

test("missing or broken dates never show a counter", () => {
  assert.equal(viewsVisible(null, now), false);
  assert.equal(viewsVisible("not a date", now), false);
});
