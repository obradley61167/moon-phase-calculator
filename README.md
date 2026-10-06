# moon-phase

Determines the lunar phase and illumination percentage for a given date using a mean synodic-month model anchored to a known new moon epoch.

## Usage

```js
import { calculatePhase, PHASE } from "./src/core.js";

const { phase, phaseName, illumination, age, isWaxing } =
  calculatePhase(Date.UTC(2024, 5, 21));

// phase        -> numeric PHASE id (see below)
// phaseName    -> "Full Moon", "First Quarter", ...
// illumination -> 0..1 illuminated fraction of the disk
// age          -> days into the current lunation
// isWaxing     -> true before full, false after
```

Exported names: `calculatePhase`, `PHASE`, `PHASE_NAMES`, `NEW_MOON_EPOCH_MS`.

`PHASE` is a frozen object: `NEW`, `WAXING_CRESCENT`, `FIRST_QUARTER`, `WAXING_GIBBOUS`, `FULL`, `WANING_GIBBOUS`, `LAST_QUARTER`, `WANING_CRESCENT`.

## Why this exists

Civilian moon-phase lookups — calendars, almanacs, small dashboards — need a number good to about a day, not the arcsecond-precise ephemeris that astronomy libraries provide. This library is one file with zero dependencies and a fixed epoch; it trades roughly one day of precision near quarter boundaries for total portability.

The model: elapsed time since the verified new moon of 2000-01-06 18:14 UTC, reduced modulo the mean synodic month (29.530588853 days). Phase names follow the conventional USNO split; each principal phase occupies a ±0.93-day window so a date landing "on" a quarter is reported as that quarter rather than immediately slipping into the adjacent crescent.

## Edge cases

- **Dates before the epoch.** The modulo is normalized to `[0, 1)` so a date in 1800 still returns a valid phase rather than a negative cycle. Don't expect pre-1900 results to match historical observations to the day — the mean-period model drifts by about a day per century.
- **Quarter boundaries.** Because phases have ±0.93-day windows, a date within that window of an exact quarter is reported as the quarter. Move ±1 day further and you land in the adjacent crescent or gibbous.
- **Illumination is geometric, not atmospheric.** It reports the illuminated fraction of the disk; apparent magnitude, libration, and atmospheric extinction are out of scope.

The input is UTC milliseconds since the Unix epoch. Pass a deterministic value (`Date.UTC(...)` or a literal) if you need reproducible output.
