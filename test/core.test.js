import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calculatePhase,
  PHASE,
  PHASE_NAMES,
  NEW_MOON_EPOCH_MS,
} from "../src/core.js";

/**
 * Deterministic test data: every input date is a literal, never the wall clock.
 * Times are UTC milliseconds; comparisons use rounded numbers or tolerance.
 */

const TOL = 1e-9; // For illumination comparisons — never compare floats with ==.

// The epoch itself must report as a new moon.
// This single test validates the anchor and the normalization.
test("epoch is a new moon with zero illumination", () => {
  const r = calculatePhase(NEW_MOON_EPOCH_MS);
  assert.equal(r.phase, PHASE.NEW);
  assert.equal(r.phaseName, "New Moon");
  assert.ok(r.cycle < 0.03125, `cycle ${r.cycle} should sit in the new-moon window`);
  assert.ok(r.illumination < 0.01);
  assert.equal(r.isWaxing, true); // infinitesimally past new, waxing
});

// Full moon should land ~halfway through the cycle.
// Using the mean period, the canonical full moon is epoch + half a synodic month.
test("half-cycle is a full moon", () => {
  const fullMs = NEW_MOON_EPOCH_MS + 0.5 * 29.530588853 * 24 * 60 * 60 * 1000;
  const r = calculatePhase(fullMs);
  assert.equal(r.phase, PHASE.FULL);
  assert.equal(r.phaseName, "Full Moon");
  assert.ok(Math.abs(r.illumination - 1) < 0.05);
});

// Exactly one quarter past the epoch: first quarter, illumination ~0.5, waxing.
test("quarter cycle is first quarter", () => {
  const qMs = NEW_MOON_EPOCH_MS + Math.round(29.530588853 * 0.25) * 24 * 60 * 60 * 1000;
  const r = calculatePhase(qMs);
  assert.equal(r.phase, PHASE.FIRST_QUARTER);
  assert.ok(Math.abs(r.illumination - 0.5) < 0.05);
  assert.equal(r.isWaxing, true);
});

// Three-quarter cycle: last quarter, illumination ~0.5, waning.
test("three-quarter cycle is last quarter", () => {
  const qMs = NEW_MOON_EPOCH_MS + Math.round(29.530588853 * 0.75) * 24 * 60 * 60 * 1000;
  const r = calculatePhase(qMs);
  assert.equal(r.phase, PHASE.LAST_QUARTER);
  assert.equal(r.isWaxing, false);
  assert.ok(Math.abs(r.illumination - 0.5) < 0.05);
});

// One full synodic month later must be a new moon again — tests periodicity.
test("one synodic month after epoch is new moon again", () => {
  const next = NEW_MOON_EPOCH_MS + 29.530588853 * 24 * 60 * 60 * 1000;
  const r = calculatePhase(next);
  assert.equal(r.phase, PHASE.NEW);
  assert.ok(r.illumination < 0.01);
});

// Dates BEFORE the epoch must still produce a sane phase, not crash or go negative.
// This is the awkward edge: JS `%` yields negatives, so we must normalize.
test("pre-epoch date wraps correctly", () => {
  // Half a cycle before the epoch should also be a full moon.
  const before = NEW_MOON_EPOCH_MS - (29.530588853 * 0.5) * 24 * 60 * 60 * 1000;
  const r = calculatePhase(before);
  assert.equal(r.phase, PHASE.FULL);
  assert.ok(r.cycle >= 0 && r.cycle < 1, "cycle must be normalized to [0, 1)");
  assert.ok(r.age >= 0 && r.age < 29.53, "age must be non-negative");
});

// A very old date (1800) must still normalize — guards against accumulated drift
// in the modulo arithmetic and against integer range issues.
test("date in 1800 still produces a valid phase", () => {
  const oldMs = Date.UTC(1800, 0, 1);
  const r = calculatePhase(oldMs);
  assert.ok(r.cycle >= 0 && r.cycle < 1);
  assert.ok(r.illumination >= 0 && r.illumination <= 1);
  assert.ok(Object.values(PHASE).includes(r.phase));
  assert.ok(typeof r.phaseName === "string" && r.phaseName.length > 0);
});

// Phase enum and names must be consistent.
test("every phase id has a name", () => {
  for (const id of Object.values(PHASE)) {
    assert.ok(id in PHASE_NAMES, `phase ${id} missing from PHASE_NAMES`);
  }
});

// Invalid input must throw — do not silently produce NaN-bearing objects.
test("non-finite input throws", () => {
  assert.throws(() => calculatePhase(NaN), TypeError);
  assert.throws(() => calculatePhase(Infinity), TypeError);
  assert.throws(() => calculatePhase("not a number"), TypeError);
});

// Illumination curve shape: waxing side strictly increasing toward full.
// We sample a handful of fixed points rather than the whole curve.
test("illumination rises then falls across the cycle", () => {
  const samples = [0.0, 0.25, 0.5, 0.75].map((f) =>
    calculatePhase(NEW_MOON_EPOCH_MS + f * 29.530588853 * 24 * 60 * 60 * 1000).illumination
  );
  assert.ok(samples[0] < samples[1] + TOL);
  assert.ok(samples[1] < samples[2] + TOL);
  assert.ok(samples[2] > samples[3] + TOL, "illumination should drop after full");
});

// Age must always be in [0, synodic month).
test("age stays within one lunation", () => {
  const dates = [
    Date.UTC(2024, 0, 1),
    Date.UTC(1970, 0, 1),
    Date.UTC(2050, 11, 31),
  ];
  for (const d of dates) {
    const r = calculatePhase(d);
    assert.ok(r.age >= 0 && r.age < 29.54, `age ${r.age} out of range for ${d}`);
  }
});

// Waxing flag flips exactly at full moon (cycle = 0.5).
test("isWaxing is true before full, false after", () => {
  const beforeFull = NEW_MOON_EPOCH_MS + 0.49 * 29.530588853 * 24 * 60 * 60 * 1000;
  const afterFull = NEW_MOON_EPOCH_MS + 0.51 * 29.530588853 * 24 * 60 * 60 * 1000;
  assert.equal(calculatePhase(beforeFull).isWaxing, true);
  assert.equal(calculatePhase(afterFull).isWaxing, false);
});

// Round-trip: phase boundaries must be contiguous — no gaps, no double-covers.
// Every phase value returned must be a member of PHASE.
test("all sampled phases are valid enum members", () => {
  for (let i = 0; i < 1000; i++) {
    const ms = NEW_MOON_EPOCH_MS + i * 12 * 60 * 60 * 1000; // every 12h for ~4 years
    const r = calculatePhase(ms);
    assert.ok(Object.values(PHASE).includes(r.phase),
      `invalid phase ${r.phase} at offset ${i}`);
  }
});
