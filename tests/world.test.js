import { describe, test, expect } from 'vitest';
import { BLOCKS } from '../src/render-data.js';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  DEFAULT_ZONE_WIDTH,
  CAVE_BIOME_START_Y,
  DEEP_DARK_START_Y,
  BIOMES,
  BIOME_WEIGHTS,
  BIOME_WIDTHS,
  BIOME_RULES,
  getBiomeAt,
  getBiomeRules,
  getZoneTable,
  buildZoneTable,
  pickWeightedBiome,
  isTransitionColumn,
  getBiomeElevationDelta,
  makeRng,
  generateWorld,
} from '../src/world.js';

describe('world constants', () => {
  test('exports WORLD_WIDTH=600, WORLD_HEIGHT=80', () => {
    expect(WORLD_WIDTH).toBe(600);
    expect(WORLD_HEIGHT).toBe(80);
  });

  test('exports DEFAULT_ZONE_WIDTH=40 (average for any consumer)', () => {
    expect(DEFAULT_ZONE_WIDTH).toBe(40);
  });

  test('exports CAVE_BIOME_START_Y=50 and DEEP_DARK_START_Y=65 constants', () => {
    expect(CAVE_BIOME_START_Y).toBe(50);
    expect(DEEP_DARK_START_Y).toBe(65);
  });

  test('BIOMES lists 13 surface biome names in the expected order', () => {
    expect(BIOMES).toEqual([
      'plains', 'forest', 'taiga', 'desert', 'snow', 'mountain',
      'jungle', 'dark_forest', 'flower_forest', 'bamboo_jungle',
      'old_growth_taiga', 'cherry_grove', 'pale_garden',
    ]);
    expect(BIOMES.length).toBe(13);
  });

  test('BIOME_WEIGHTS has an entry for every biome with positive integer weights', () => {
    for (const biome of BIOMES) {
      expect(BIOME_WEIGHTS).toHaveProperty(biome);
      expect(Number.isInteger(BIOME_WEIGHTS[biome])).toBe(true);
      expect(BIOME_WEIGHTS[biome]).toBeGreaterThan(0);
    }
    // Total weight per the spec is 59.
    const total = Object.values(BIOME_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(59);
  });

  test('BIOME_WIDTHS has an entry for every biome with minW <= maxW', () => {
    for (const biome of BIOMES) {
      expect(BIOME_WIDTHS).toHaveProperty(biome);
      const { minW, maxW } = BIOME_WIDTHS[biome];
      expect(Number.isInteger(minW)).toBe(true);
      expect(Number.isInteger(maxW)).toBe(true);
      expect(minW).toBeGreaterThan(0);
      expect(maxW).toBeGreaterThanOrEqual(minW);
    }
  });

  test('BIOME_RULES has an entry for every biome', () => {
    for (const biome of BIOMES) {
      expect(BIOME_RULES).toHaveProperty(biome);
      const rules = BIOME_RULES[biome];
      expect(rules).toHaveProperty('surface');
      expect(rules).toHaveProperty('subSurface');
      expect(rules).toHaveProperty('deep');
      expect(rules).toHaveProperty('treeType');
      expect(typeof rules.treeChance).toBe('number');
      expect(typeof rules.elevationDelta).toBe('number');
    }
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

  test('new biomes have expected tree types', () => {
    expect(getBiomeRules('taiga').treeType).toBe('spruce');
    expect(getBiomeRules('old_growth_taiga').treeType).toBe('spruce');
    expect(getBiomeRules('jungle').treeType).toBe('jungle');
    expect(getBiomeRules('bamboo_jungle').treeType).toBe('bamboo');
    expect(getBiomeRules('flower_forest').treeType).toBe('oak');
    expect(getBiomeRules('dark_forest').treeType).toBe('dark_oak');
    expect(getBiomeRules('cherry_grove').treeType).toBe('cherry');
    expect(getBiomeRules('pale_garden').treeType).toBe('pale');
  });
});

describe('pickWeightedBiome', () => {
  test('returns a valid biome name', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (let zone = 0; zone < 10; zone++) {
        const biome = pickWeightedBiome(seed, zone);
        expect(BIOMES).toContain(biome);
      }
    }
  });

  test('is deterministic for the same (seed, zoneIndex)', () => {
    expect(pickWeightedBiome(42, 0)).toBe(pickWeightedBiome(42, 0));
    expect(pickWeightedBiome(123, 5)).toBe(pickWeightedBiome(123, 5));
  });
});

describe('getBiomeAt', () => {
  test('is deterministic across two calls with same (x, seed)', () => {
    expect(getBiomeAt(0, 42)).toBe(getBiomeAt(0, 42));
    expect(getBiomeAt(37, 123)).toBe(getBiomeAt(37, 123));
    expect(getBiomeAt(500, 7)).toBe(getBiomeAt(500, 7));
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
    for (let s = 0; s < 10; s++) {
      for (let x = 0; x < WORLD_WIDTH; x += 25) {
        expect(BIOMES).toContain(getBiomeAt(x, s));
      }
    }
  });

  test('every column inside a single zone reports the same biome', () => {
    const table = getZoneTable(42);
    for (const zone of table) {
      for (let x = zone.startX; x < zone.endX; x++) {
        expect(getBiomeAt(x, 42)).toBe(zone.biome);
      }
    }
  });
});

describe('getZoneTable', () => {
  test('is non-empty', () => {
    expect(getZoneTable(42).length).toBeGreaterThan(0);
  });

  test('first zone starts at 0 and last zone ends at WORLD_WIDTH', () => {
    const table = getZoneTable(42);
    expect(table[0].startX).toBe(0);
    expect(table[table.length - 1].endX).toBe(WORLD_WIDTH);
  });

  test('tiles [0, WORLD_WIDTH) with no gaps or overlaps', () => {
    const table = getZoneTable(42);
    for (let i = 0; i < table.length - 1; i++) {
      expect(table[i].endX).toBe(table[i + 1].startX);
      expect(table[i].endX).toBeGreaterThan(table[i].startX);
    }
    // Cumulative coverage equals WORLD_WIDTH.
    const covered = table.reduce((sum, z) => sum + (z.endX - z.startX), 0);
    expect(covered).toBe(WORLD_WIDTH);
  });

  test('every zone has a width within BIOME_WIDTHS[biome] range (last zone may be smaller if trimmed)', () => {
    const table = getZoneTable(42);
    for (let i = 0; i < table.length; i++) {
      const zone = table[i];
      const width = zone.endX - zone.startX;
      const { minW, maxW } = BIOME_WIDTHS[zone.biome];
      if (i === table.length - 1) {
        // Last zone may be trimmed smaller than minW.
        expect(width).toBeGreaterThan(0);
        expect(width).toBeLessThanOrEqual(maxW);
      } else {
        expect(width).toBeGreaterThanOrEqual(minW);
        expect(width).toBeLessThanOrEqual(maxW);
      }
    }
  });

  test('every zone biome is in the BIOMES list', () => {
    const table = getZoneTable(42);
    for (const zone of table) {
      expect(BIOMES).toContain(zone.biome);
    }
  });

  test('is deterministic by JSON equality across two calls with same seed', () => {
    expect(JSON.stringify(getZoneTable(42))).toBe(JSON.stringify(getZoneTable(42)));
    expect(JSON.stringify(getZoneTable(7))).toBe(JSON.stringify(getZoneTable(7)));
  });

  test('returns the same array reference on repeat calls (memoization)', () => {
    const a = getZoneTable(99);
    const b = getZoneTable(99);
    expect(a).toBe(b);
  });

  test('buildZoneTable produces an equivalent table without memoization', () => {
    const fresh = buildZoneTable(42);
    const cached = getZoneTable(42);
    expect(JSON.stringify(fresh)).toBe(JSON.stringify(cached));
  });
});

describe('rare biomes reachable', () => {
  test('cherry_grove appears across seeds 0..200', () => {
    let found = false;
    for (let s = 0; s <= 200 && !found; s++) {
      const table = getZoneTable(s);
      if (table.some((z) => z.biome === 'cherry_grove')) found = true;
    }
    expect(found).toBe(true);
  });

  test('pale_garden appears across seeds 0..200', () => {
    let found = false;
    for (let s = 0; s <= 200 && !found; s++) {
      const table = getZoneTable(s);
      if (table.some((z) => z.biome === 'pale_garden')) found = true;
    }
    expect(found).toBe(true);
  });
});

describe('isTransitionColumn', () => {
  test('returns true at startX and startX+1 of any zone (left edge transitions)', () => {
    const table = getZoneTable(42);
    for (const zone of table) {
      expect(isTransitionColumn(zone.startX, 42)).toBe(true);
      if (zone.startX + 1 < zone.endX) {
        expect(isTransitionColumn(zone.startX + 1, 42)).toBe(true);
      }
    }
  });

  test('returns true at endX-1 and endX-2 of any zone (right edge transitions)', () => {
    const table = getZoneTable(42);
    for (const zone of table) {
      const w = zone.endX - zone.startX;
      if (w >= 1) expect(isTransitionColumn(zone.endX - 1, 42)).toBe(true);
      if (w >= 2) expect(isTransitionColumn(zone.endX - 2, 42)).toBe(true);
    }
  });

  test('returns false at the interior midpoint of a wide zone', () => {
    const table = getZoneTable(42);
    // Find a zone wide enough to have a clean interior.
    const wide = table.find((z) => z.endX - z.startX >= 10);
    expect(wide).toBeDefined();
    const mid = Math.floor((wide.startX + wide.endX) / 2);
    expect(isTransitionColumn(mid, 42)).toBe(false);
  });
});

describe('getBiomeElevationDelta', () => {
  test('at an interior column returns the biome\'s own delta exactly', () => {
    const table = getZoneTable(42);
    const wide = table.find((z) => z.endX - z.startX >= 10);
    expect(wide).toBeDefined();
    const mid = Math.floor((wide.startX + wide.endX) / 2);
    const expected = BIOME_RULES[wide.biome].elevationDelta;
    expect(getBiomeElevationDelta(mid, 42)).toBe(expected);
  });

  test('at a left-edge transition column averages with the left neighbor zone', () => {
    const table = getZoneTable(42);
    // Find a non-first zone to inspect its left edge.
    const idx = table.findIndex((z, i) => i > 0);
    expect(idx).toBeGreaterThanOrEqual(1);
    const zone = table[idx];
    const left = table[idx - 1];
    const x = zone.startX; // left-edge transition col
    const expected = (BIOME_RULES[zone.biome].elevationDelta +
                      BIOME_RULES[left.biome].elevationDelta) / 2;
    expect(getBiomeElevationDelta(x, 42)).toBe(expected);
  });

  test('at a right-edge transition column averages with the right neighbor zone', () => {
    const table = getZoneTable(42);
    // Find a non-last zone to inspect its right edge.
    const idx = table.findIndex((z, i) => i < table.length - 1);
    expect(idx).toBeGreaterThanOrEqual(0);
    const zone = table[idx];
    const right = table[idx + 1];
    const x = zone.endX - 1; // right-edge transition col
    const expected = (BIOME_RULES[zone.biome].elevationDelta +
                      BIOME_RULES[right.biome].elevationDelta) / 2;
    expect(getBiomeElevationDelta(x, 42)).toBe(expected);
  });
});

describe('makeRng', () => {
  test('same seed produces same first value', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect(a()).toBe(b());
  });

  test('same seed produces same first 3 values', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
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

  test('contains at least 3 distinct surface block types for seed 42', () => {
    const w = generateWorld(42);
    // Collect surface blocks: first non-AIR, non-tree block from top in each column.
    const surfaces = new Set();
    for (let x = 0; x < WORLD_WIDTH; x++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const b = w[x][y];
        if (b === BLOCKS.AIR) continue;
        // Skip tree parts (wood / leaves / cactus / pine_leaves).
        if (b === BLOCKS.WOOD || b === BLOCKS.LEAVES ||
            b === BLOCKS.CACTUS || b === BLOCKS.PINE_LEAVES) continue;
        // Skip new tree wood/leaves (ids 18,19,21,24,25,26,27,28,29,30,31,32).
        if (b >= 18 && b <= 32) continue;
        surfaces.add(b);
        break;
      }
    }
    expect(surfaces.size).toBeGreaterThanOrEqual(3);
  });
});
