// Day / night cycle. All units are game ticks (60 ticks ≈ 1 sec).
export const DAY_LENGTH_TICKS = 6000;      // ~1.7 min at 60 fps (shorter day)
export const SUNSET_LENGTH_TICKS = 1500;   // 25 sec
export const NIGHT_LENGTH_TICKS = 9000;    // ~2.5 min (longer night)
export const SUNRISE_LENGTH_TICKS = 1500;  // 25 sec
export const TOTAL_CYCLE_TICKS =
  DAY_LENGTH_TICKS + SUNSET_LENGTH_TICKS + NIGHT_LENGTH_TICKS + SUNRISE_LENGTH_TICKS;

const ANCHORS = {
  day:     '#87CEEB',
  sunset:  '#FF8C42',  // midpoint orange
  night:   '#0A0A28',
  sunrise: '#FFB37A',  // midpoint orange-pink
};

// Daytime sunlight damage per tick applied to zombies.
const DAY_SUNLIGHT_DAMAGE = 0.1;

// Parse '#rrggbb' (case-insensitive) into [r, g, b] integers in 0..255.
function parseHex(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function toHexChannel(n) {
  const clamped = Math.max(0, Math.min(255, Math.floor(n)));
  return clamped.toString(16).padStart(2, '0');
}

// Pure linear interpolation between two hex colors.
// lerpHex('#000000', '#ffffff', 0.5) === '#7f7f7f'.
export function lerpHex(a, b, t) {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const r = ar + (br - ar) * t;
  const g = ag + (bg - ag) * t;
  const b2 = ab + (bb - ab) * t;
  return '#' + toHexChannel(r) + toHexChannel(g) + toHexChannel(b2);
}

// Returns the time-of-day state for an absolute tick value.
// The cycle wraps modulo TOTAL_CYCLE_TICKS, so any tick (incl. negatives) is valid.
export function getTimeOfDay(tick) {
  // Modulo that handles negatives the way you'd expect.
  const cycleTick =
    ((Math.floor(tick) % TOTAL_CYCLE_TICKS) + TOTAL_CYCLE_TICKS) % TOTAL_CYCLE_TICKS;

  // Phase 1: day
  if (cycleTick < DAY_LENGTH_TICKS) {
    return {
      phase: 'day',
      skyColor: ANCHORS.day,
      zombieSpawnAllowed: false,
      sunlightDamage: DAY_SUNLIGHT_DAMAGE,
    };
  }

  // Phase 2: sunset
  const sunsetStart = DAY_LENGTH_TICKS;
  if (cycleTick < sunsetStart + SUNSET_LENGTH_TICKS) {
    const t = (cycleTick - sunsetStart) / SUNSET_LENGTH_TICKS;  // 0..1
    let skyColor;
    if (t <= 0.5) {
      // day → sunset (orange) over first half
      skyColor = lerpHex(ANCHORS.day, ANCHORS.sunset, t * 2);
    } else {
      // sunset (orange) → night over second half
      skyColor = lerpHex(ANCHORS.sunset, ANCHORS.night, (t - 0.5) * 2);
    }
    return {
      phase: 'sunset',
      skyColor,
      zombieSpawnAllowed: false,
      sunlightDamage: 0,
    };
  }

  // Phase 3: night
  const nightStart = sunsetStart + SUNSET_LENGTH_TICKS;
  if (cycleTick < nightStart + NIGHT_LENGTH_TICKS) {
    return {
      phase: 'night',
      skyColor: ANCHORS.night,
      zombieSpawnAllowed: true,
      sunlightDamage: 0,
    };
  }

  // Phase 4: sunrise
  const sunriseStart = nightStart + NIGHT_LENGTH_TICKS;
  const t = (cycleTick - sunriseStart) / SUNRISE_LENGTH_TICKS;  // 0..1
  let skyColor;
  if (t <= 0.5) {
    skyColor = lerpHex(ANCHORS.night, ANCHORS.sunrise, t * 2);
  } else {
    skyColor = lerpHex(ANCHORS.sunrise, ANCHORS.day, (t - 0.5) * 2);
  }
  // Sunlight damage ramps 0 → DAY_SUNLIGHT_DAMAGE across sunrise.
  return {
    phase: 'sunrise',
    skyColor,
    zombieSpawnAllowed: false,
    sunlightDamage: DAY_SUNLIGHT_DAMAGE * t,
  };
}

// Convenience: should a new zombie spawn right now?
export function shouldSpawnZombie(tod, mobCount, maxMobs = 10) {
  return !!tod.zombieSpawnAllowed && mobCount < maxMobs;
}
