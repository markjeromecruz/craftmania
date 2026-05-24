import { describe, test, expect } from 'vitest';
import {
  DAY_LENGTH_TICKS,
  SUNSET_LENGTH_TICKS,
  NIGHT_LENGTH_TICKS,
  SUNRISE_LENGTH_TICKS,
  TOTAL_CYCLE_TICKS,
  lerpHex,
  getTimeOfDay,
  shouldSpawnZombie,
} from '../src/time.js';

describe('time constants', () => {
  test('exports the expected lengths', () => {
    expect(DAY_LENGTH_TICKS).toBe(14400);
    expect(SUNSET_LENGTH_TICKS).toBe(1800);
    expect(NIGHT_LENGTH_TICKS).toBe(3600);
    expect(SUNRISE_LENGTH_TICKS).toBe(1800);
    expect(TOTAL_CYCLE_TICKS).toBe(
      DAY_LENGTH_TICKS + SUNSET_LENGTH_TICKS + NIGHT_LENGTH_TICKS + SUNRISE_LENGTH_TICKS
    );
  });
});

describe('lerpHex', () => {
  test('returns endpoint at t=0', () => {
    expect(lerpHex('#000000', '#ffffff', 0).toLowerCase()).toBe('#000000');
  });

  test('returns endpoint at t=1', () => {
    expect(lerpHex('#000000', '#ffffff', 1).toLowerCase()).toBe('#ffffff');
  });

  test('returns midpoint at t=0.5', () => {
    expect(lerpHex('#000000', '#ffffff', 0.5).toLowerCase()).toBe('#7f7f7f');
  });

  test('handles colored midpoints', () => {
    // (#ff0000 + #00ff00) / 2 = #7f7f00
    expect(lerpHex('#ff0000', '#00ff00', 0.5).toLowerCase()).toBe('#7f7f00');
  });

  test('accepts uppercase or lowercase input', () => {
    expect(lerpHex('#FF0000', '#0000ff', 0).toLowerCase()).toBe('#ff0000');
  });
});

describe('getTimeOfDay', () => {
  test('tick 0 is day phase', () => {
    expect(getTimeOfDay(0).phase).toBe('day');
  });

  test('tick 0 sky color is sky blue', () => {
    expect(getTimeOfDay(0).skyColor.toLowerCase()).toBe('#87ceeb');
  });

  test('tick 0 disallows zombie spawn (it\'s daytime)', () => {
    expect(getTimeOfDay(0).zombieSpawnAllowed).toBe(false);
  });

  test('tick 0 inflicts sunlight damage > 0', () => {
    expect(getTimeOfDay(0).sunlightDamage).toBeGreaterThan(0);
  });

  test('day phase has sunlightDamage of 0.1', () => {
    expect(getTimeOfDay(100).sunlightDamage).toBe(0.1);
  });

  test('phase becomes sunset right at DAY_LENGTH_TICKS', () => {
    expect(getTimeOfDay(DAY_LENGTH_TICKS).phase).toBe('sunset');
  });

  test('phase becomes night after sunset', () => {
    expect(getTimeOfDay(DAY_LENGTH_TICKS + SUNSET_LENGTH_TICKS).phase).toBe('night');
  });

  test('night allows zombie spawn', () => {
    expect(
      getTimeOfDay(DAY_LENGTH_TICKS + SUNSET_LENGTH_TICKS + 1).zombieSpawnAllowed
    ).toBe(true);
  });

  test('night sunlightDamage is 0', () => {
    expect(
      getTimeOfDay(DAY_LENGTH_TICKS + SUNSET_LENGTH_TICKS + 100).sunlightDamage
    ).toBe(0);
  });

  test('night sky color is the dark anchor', () => {
    expect(
      getTimeOfDay(DAY_LENGTH_TICKS + SUNSET_LENGTH_TICKS + 100).skyColor.toLowerCase()
    ).toBe('#0a0a28');
  });

  test('phase becomes sunrise after night', () => {
    expect(
      getTimeOfDay(DAY_LENGTH_TICKS + SUNSET_LENGTH_TICKS + NIGHT_LENGTH_TICKS).phase
    ).toBe('sunrise');
  });

  test('sunrise sunlightDamage ramps from 0 toward 0.1', () => {
    const startSunrise = DAY_LENGTH_TICKS + SUNSET_LENGTH_TICKS + NIGHT_LENGTH_TICKS;
    const start = getTimeOfDay(startSunrise).sunlightDamage;
    const mid = getTimeOfDay(startSunrise + Math.floor(SUNRISE_LENGTH_TICKS / 2)).sunlightDamage;
    const end = getTimeOfDay(startSunrise + SUNRISE_LENGTH_TICKS - 1).sunlightDamage;
    expect(start).toBeCloseTo(0, 5);
    expect(mid).toBeGreaterThan(start);
    expect(end).toBeGreaterThan(mid);
    expect(end).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  test('cycle wraps: TOTAL_CYCLE_TICKS behaves like tick 0', () => {
    expect(getTimeOfDay(TOTAL_CYCLE_TICKS).phase).toBe('day');
    expect(getTimeOfDay(TOTAL_CYCLE_TICKS * 3 + 50).phase).toBe(
      getTimeOfDay(50).phase
    );
  });

  test('negative tick still wraps cleanly', () => {
    // Should not throw and should land in a valid phase
    const result = getTimeOfDay(-100);
    expect(['day', 'sunset', 'night', 'sunrise']).toContain(result.phase);
  });
});

describe('shouldSpawnZombie', () => {
  test('returns true when spawn allowed and mob count below cap', () => {
    expect(shouldSpawnZombie({ zombieSpawnAllowed: true }, 5, 10)).toBe(true);
  });

  test('returns false when spawn allowed but at cap', () => {
    expect(shouldSpawnZombie({ zombieSpawnAllowed: true }, 10, 10)).toBe(false);
  });

  test('returns false when spawn not allowed (daytime)', () => {
    expect(shouldSpawnZombie({ zombieSpawnAllowed: false }, 0, 10)).toBe(false);
  });

  test('default cap is 10', () => {
    expect(shouldSpawnZombie({ zombieSpawnAllowed: true }, 9)).toBe(true);
    expect(shouldSpawnZombie({ zombieSpawnAllowed: true }, 10)).toBe(false);
  });
});
