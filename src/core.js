/**
 * Core lunar phase calculations.
 *
 * All math derives from the synodic month (the mean time between successive
 * new moons, ~29.53 days). We measure elapsed time since a fixed new moon
 * epoch and reduce modulo the synodic period to get the cycle position.
 *
 * Why a mean-period model rather than full ephemeris?
 *   It is one file, zero dependencies, and accurate to within about a day for
 *   any historical or near-future date — which is all a civilian "what phase
 *   is the moon tonight?" tool needs. The trade-off is documented in the
 *   README: we trade ~1% precision for total portability.
 */

// A verified new moon moment (2000-01-06 18:14 UTC, NASA / USNO).
// Anchoring the cycle here keeps every other date a simple delta.
export const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

// Mean synodic month in milliseconds.
// 29.530588853 days is the long-term average from Jean Meeus' Astronomical
// Algorithms; good enough that drift stays under a day for millennia.
const SYNODIC_MONTH_MS = 29.530588853 * 24 * 60 * 60 * 1000;

/**
 * Phase identifiers, stable across releases.
 *
 * Boundary thresholds (in cycle fraction) between named phases follow the
 * conventional 50% illumination split used by the US Naval Observatory:
 *   0.000, 0.125, 0.375, 0.625, 0.875, 1.000
 * with ±0.0625 around each event treated as the event itself (Waxing/
 * Waning Crescent etc. fill the gaps). This is the one defensible choice
 * because every source agrees on the four principal phases; only the
 * intermediate widths vary, and we pick the symmetric one.
 */
export const PHASE = Object.freeze({
  NEW: 0,
  WAXING_CRESCENT: 1,
  FIRST_QUARTER: 2,
  WAXING_GIBBOUS: 3,
  FULL: 4,
  WANING_GIBBOUS: 5,
  LAST_QUARTER: 6,
  WANING_CRESCENT: 7,
});

export const PHASE_NAMES = Object.freeze({
  [PHASE.NEW]: "New Moon",
  [PHASE.WAXING_CRESCENT]: "Waxing Crescent",
  [PHASE.FIRST_QUARTER]: "First Quarter",
  [PHASE.WAXING_GIBBOUS]: "Waxing Gibbous",
  [PHASE.FULL]: "Full Moon",
  [PHASE.WANING_GIBBOUS]: "Waning Gibbous",
  [PHASE.LAST_QUARTER]: "Last Quarter",
  [PHASE.WANING_CRESCENT]: "Waning Crescent",
});

/**
 * Reduce an arbitrary cycle position to [0, 1).
 *
 * JS `%` can return negatives for negative dividends, which would index
 * invalid phase ids. We add 1 and re-mod to keep everything well-defined.
 */
function normalizeCycle(cycle) {
  const normalized = ((cycle % 1) + 1) % 1;
  // Guard against IEEE-754 rounding producing exactly 1.0.
  return normalized >= 1 ? 0 : normalized;
}

/**
 * Classify a cycle position into a PHASE id.
 *
 * Each principal phase occupies a ±0.03125 window (~0.93 days) so that a
 * date that lands "on" a quarter is reported as that quarter rather than
 * immediately flipping to the adjacent crescent/gibbous.
 */
function classifyPhase(cycle) {
  const c = normalizeCycle(cycle);

  // Principal phases first — their windows sit astride the named points.
  if (c < 0.03125 || c >= 0.96875) return PHASE.NEW;
  if (Math.abs(c - 0.25) < 0.03125) return PHASE.FIRST_QUARTER;
  if (Math.abs(c - 0.50) < 0.03125) return PHASE.FULL;
  if (Math.abs(c - 0.75) < 0.03125) return PHASE.LAST_QUARTER;

  // Intermediate phases fill the gaps symmetrically.
  if (c < 0.25) return PHASE.WAXING_CRESCENT;
  if (c < 0.50) return PHASE.WAXING_GIBBOUS;
  if (c < 0.75) return PHASE.WANING_GIBBOUS;
  return PHASE.WANING_CRESCENT;
}

/**
 * Illuminated fraction of the lunar disk (0–1).
 *
 * Standard spherical geometry: at cycle angle θ the illuminated fraction is
 * (1 − cos θ)/2. At θ=0 (new) we get 0; θ=π/2 (first quarter) → 0.5;
 * θ=π (full) → 1. This is independent of the phase-name thresholds above.
 */
function illumination(cycle) {
  const c = normalizeCycle(cycle);
  const theta = 2 * Math.PI * c;
  return (1 - Math.cos(theta)) / 2;
}

/**
 * Compute the full lunar state for a single date.
 *
 * @param {number} dateMs - UTC milliseconds since the Unix epoch.
 * @returns {{
 *   phase: number,
 *   phaseName: string,
 *   cycle: number,
 *   illumination: number,
 *   age: number,
 *   isWaxing: boolean
 * }}
 */
export function calculatePhase(dateMs) {
  if (typeof dateMs !== "number" || !Number.isFinite(dateMs)) {
    throw new TypeError("dateMs must be a finite number of milliseconds");
  }

  const elapsed = dateMs - NEW_MOON_EPOCH_MS;
  const cycle = normalizeCycle(elapsed / SYNODIC_MONTH_MS);

  // Age in days is just cycle × synodic period — the elapsed time within
  // the current lunation. Useful for "moon is N days old" displays.
  const age = cycle * 29.530588853;

  return {
    phase: classifyPhase(cycle),
    phaseName: PHASE_NAMES[classifyPhase(cycle)],
    cycle,
    illumination: illumination(cycle),
    age,
    isWaxing: cycle < 0.5,
  };
}
