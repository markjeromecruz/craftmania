import { describe, test, expect } from 'vitest';
import { BLOCKS } from '../src/render-data.js';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  BIOMES,
  BIOME_ZONE_WIDTH,
  BIOME_RULES,
  getBiomeAt,
  getBiomeRules,
  isTransitionColumn,
  getBiomeElevationDelta,
  makeRng,
  generateWorld,
} from '../src/world.js';

describe('world constants', () => {
  test('exports WORLD_WIDTH=100, WORLD_HEIGHT=50, BIOME_ZONE_WIDTH=20', () => {
    expect(WORLD_WIDTH).toBe(100);
    expect(WORLD_HEIGHT).toBe(50);
    expect(BIOME_ZONE_WIDTH).toBe(20);
  });

  test('BIOMES lists the 5 biome names', () => {
    expect(BIOMES).toEqual(['plains', 'desert', 'forest', 'mountain', 'snow']);
  });
});

describe('getBiomeAt', () => {
  test('is deterministic across two calls with same (x, seed)', () => {
    expect(getBiomeAt(0, 42)).toBe(getBiomeAt(0, 42));
    expect(getBiomeAt(37, 123)).toBe(getBiomeAt(37, 123));
  });

  test('returns same biome for all columns within one zone', () => {
    // zone 0 = cols 0..19
    const b0 = getBiomeAt(0, 42);
    for (let x = 0; x < BIOME_ZONE_WIDTH; x++) {
      expect(getBiomeAt(x, 42)).toBe(b0);
    }
  });

  test('different seeds may yield different biomes (at least one seed in 0..50 differs from seed 42)', () => {
    const base = getBiomeAt(0, 42);
    let differs = false;
    for (let s = 0; s <= 50; s++) {
      if (s === 42) continue;
      if (getBiomeAt(0, s) !== base) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  test('returns a valid biome name', () => {
    for (let s = 0; s < 20; s++) {
      for (let x = 0; x < WORLD_WIDTH; x += 5) {
        expect(BIOMES).toContain(getBiomeAt(x, s));
      }
    }
  });

  test('all 5 biomes appear across the 5 zones for at least one seed in 0..200', () => {
    let foundSeed = -1;
    for (let s = 0; s <= 200; s++) {
      const zoneBiomes = new Set();
      for (let zone = 0; zone < 5; zone++) {
        zoneBiomes.add(getBiomeAt(zone * BIOME_ZONE_WIDTH, s));
      }
      if (zoneBiomes.size === 5) {
        foundSeed = s;
        break;
      }
    }
    expect(foundSeed, 'expected some seed in 0..200 to map to all 5 distinct biomes').not.toBe(-1);
  });
});

describe('getBiomeRules', () => {
  test('returns plains rules for "plains"', () => {
    const rules = getBiomeRules('plains');
    expect(rules.surface).toBe(BLOCKS.GRASS);
    expect(rules.subSurface).toBe(BLOCKS.DIRT);
    expect(rules.deep).toBe(BLOCKS.STONE);
    expect(rules.treeType).toBe('oak');
  });

  test('returns desert rules with SAND surface and cactus trees', () => {
    const rules = getBiomeRules('desert');
    expect(rules.surface).toBe(BLOCKS.SAND);
    expect(rules.treeType).toBe('cactus');
  });

  test('returns snow rules with SNOW surface and pine trees', () => {
    const rules = getBiomeRules('snow');
    expect(rules.surface).toBe(BLOCKS.SNOW);
    expect(rules.treeType).toBe('pine');
  });

  test('falls back to plains for unknown biome', () => {
    expect(getBiomeRules('unknown')).toBe(BIOME_RULES.plains);
    expect(getBiomeRules(undefined)).toBe(BIOME_RULES.plains);
  });
});

describe('isTransitionColumn', () => {
  test('returns true within 2 of a zone edge', () => {
    expect(isTransitionColumn(0)).toBe(true);
    expect(isTransitionColumn(1)).toBe(true);
    expect(isTransitionColumn(18)).toBe(true);
    expect(isTransitionColumn(19)).toBe(true);
    expect(isTransitionColumn(20)).toBe(true);
    expect(isTransitionColumn(21)).toBe(true);
  });

  test('returns false at zone interior', () => {
    expect(isTransitionColumn(10)).toBe(false);
    expect(isTransitionColumn(30)).toBe(false);
    expect(isTransitionColumn(50)).toBe(false);
  });
});

describe('getBiomeElevationDelta', () => {
  test('at non-transition col returns this biome\'s elevationDelta', () => {
    // col 10 sits in zone 0 (cols 0..19), interior
    const biome = getBiomeAt(10, 42);
    expect(getBiomeElevationDelta(10, 42)).toBe(BIOME_RULES[biome].elevationDelta);
  });

  test('at transition col returns the average of the two neighboring zone deltas', () => {
    // col 20 is on the zone 0 / zone 1 boundary
    const biomeA = getBiomeAt(10, 42);  // zone 0 interior
    const biomeB = getBiomeAt(30, 42);  // zone 1 interior
    const expected = (BIOME_RULES[biomeA].elevationDelta + BIOME_RULES[biomeB].elevationDelta) / 2;
    expect(getBiomeElevationDelta(20, 42)).toBe(expected);
  });
});

describe('makeRng', () => {
  test('same seed produces same first value', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect(a()).toBe(b());
  });

  test('different seeds produce different sequences', () => {
    const a = makeRng(42);
    const b = makeRng(43);
    expect(a()).not.toBe(b());
  });

  test('yields values in [0, 1)', () => {
    const r = makeRng(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('generateWorld', () => {
  test('returns a 2D array of width WORLD_WIDTH and column height WORLD_HEIGHT', () => {
    const w = generateWorld(42);
    expect(w.length).toBe(WORLD_WIDTH);
    for (let x = 0; x < WORLD_WIDTH; x++) {
      expect(w[x].length).toBe(WORLD_HEIGHT);
    }
  });

  test('bottom row is all BEDROCK', () => {
    const w = generateWorld(42);
    for (let x = 0; x < WORLD_WIDTH; x++) {
      expect(w[x][WORLD_HEIGHT - 1]).toBe(BLOCKS.BEDROCK);
    }
  });

  test('top row (y=0) is all AIR', () => {
    const w = generateWorld(42);
    for (let x = 0; x < WORLD_WIDTH; x++) {
      expect(w[x][0]).toBe(BLOCKS.AIR);
    }
  });

  test('is deterministic (JSON equality across two calls)', () => {
    const a = generateWorld(42);
    const b = generateWorld(42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('different seeds produce different worlds', () => {
    const a = generateWorld(42);
    const b = generateWorld(7);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  test('contains at least 2 distinct surface block types for some seed with multiple biomes', () => {
    // Search for a seed where the 5 zones contain at least 2 different biomes.
    let chosenSeed = -1;
    for (let s = 0; s <= 200; s++) {
      const zones = new Set();
      for (let zone = 0; zone < 5; zone++) zones.add(getBiomeAt(zone * BIOME_ZONE_WIDTH, s));
      if (zones.size >= 2) {
        chosenSeed = s;
        break;
      }
    }
    expect(chosenSeed, 'expected a seed with at least 2 biomes').not.toBe(-1);

    const w = generateWorld(chosenSeed);
    // Collect surface blocks: for each column, find first non-AIR block from top
    const surfaces = new Set();
    for (let x = 0; x < WORLD_WIDTH; x++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const b = w[x][y];
        if (b !== BLOCKS.AIR && b !== BLOCKS.WOOD && b !== BLOCKS.LEAVES &&
            b !== BLOCKS.CACTUS && b !== BLOCKS.PINE_LEAVES) {
          surfaces.add(b);
          break;
        }
      }
    }
    expect(surfaces.size).toBeGreaterThanOrEqual(2);
  });
});
