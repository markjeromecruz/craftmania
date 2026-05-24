import { BLOCKS } from './render-data.js';

// World dimensions and biome layout.
export const WORLD_WIDTH = 100;
export const WORLD_HEIGHT = 50;
export const BIOMES = ['plains', 'desert', 'forest', 'mountain', 'snow'];
export const BIOME_ZONE_WIDTH = 20;  // 5 zones of 20 cols = 100 cols total

// Per-biome generation rules. Keys mirror BIOMES.
export const BIOME_RULES = {
  plains:   { surface: BLOCKS.GRASS, subSurface: BLOCKS.DIRT, deep: BLOCKS.STONE, elevationDelta: 0,  treeChance: 0.10, treeType: 'oak'    },
  desert:   { surface: BLOCKS.SAND,  subSurface: BLOCKS.SAND, deep: BLOCKS.STONE, elevationDelta: -3, treeChance: 0.04, treeType: 'cactus' },
  forest:   { surface: BLOCKS.GRASS, subSurface: BLOCKS.DIRT, deep: BLOCKS.STONE, elevationDelta: 1,  treeChance: 0.30, treeType: 'oak'    },
  mountain: { surface: BLOCKS.STONE, subSurface: BLOCKS.STONE, deep: BLOCKS.STONE, elevationDelta: 8, treeChance: 0.02, treeType: 'oak'    },
  snow:     { surface: BLOCKS.SNOW,  subSurface: BLOCKS.DIRT, deep: BLOCKS.STONE, elevationDelta: 2,  treeChance: 0.12, treeType: 'pine'   },
};

// Returns the rules object for the given biome name. Falls back to plains.
export function getBiomeRules(biome) {
  return BIOME_RULES[biome] ?? BIOME_RULES.plains;
}

// Tiny deterministic hash (xorshift32-ish) of a 32-bit unsigned int.
// Same input → same output across runs.
function hash32(n) {
  let x = n | 0;
  x = (x ^ 0x9E3779B9) | 0;
  x = (x ^ (x << 13)) | 0;
  x = (x ^ (x >>> 17)) | 0;
  x = (x ^ (x << 5)) | 0;
  return x >>> 0;  // unsigned
}

// Mulberry32 PRNG factory. Same seed → same sequence.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns the biome name for column x given a world seed. Deterministic.
// All columns in the same 20-col zone share a biome.
export function getBiomeAt(x, seed) {
  const zoneIndex = Math.floor(x / BIOME_ZONE_WIDTH);
  // Combine seed + zone into a single 32-bit int before hashing
  const combined = ((seed >>> 0) * 2654435761 + zoneIndex * 374761393) >>> 0;
  const h = hash32(combined);
  return BIOMES[h % BIOMES.length];
}

// A column is a "transition column" if it sits within 2 cols of a zone boundary.
// e.g. with BIOME_ZONE_WIDTH=20: cols 0,1, 18,19, 20,21, 38,39, 40,41, ...
export function isTransitionColumn(x) {
  const inZone = ((x % BIOME_ZONE_WIDTH) + BIOME_ZONE_WIDTH) % BIOME_ZONE_WIDTH;
  return inZone <= 1 || inZone >= BIOME_ZONE_WIDTH - 2;
}

// Smoothed elevation delta. At interior cols returns this biome's delta;
// at transition cols averages with the adjacent zone's delta.
export function getBiomeElevationDelta(x, seed) {
  const biome = getBiomeAt(x, seed);
  const myDelta = getBiomeRules(biome).elevationDelta;

  if (!isTransitionColumn(x)) return myDelta;

  // Find the neighbor zone we are transitioning toward.
  const inZone = ((x % BIOME_ZONE_WIDTH) + BIOME_ZONE_WIDTH) % BIOME_ZONE_WIDTH;
  let neighborX;
  if (inZone <= 1) {
    // Near the left edge of this zone → neighbor is the zone to the left.
    neighborX = x - BIOME_ZONE_WIDTH;
  } else {
    // Near the right edge → neighbor is the zone to the right.
    neighborX = x + BIOME_ZONE_WIDTH;
  }

  const neighborBiome = getBiomeAt(neighborX, seed);
  const neighborDelta = getBiomeRules(neighborBiome).elevationDelta;
  return (myDelta + neighborDelta) / 2;
}

// Place a tree (or cactus / pine) at column x with its base on top of `groundY`.
// `world` is the 2D array being built; `rules` are the biome rules; `rng` is the seeded PRNG.
function placeTree(world, x, groundY, rules, rng) {
  const treeType = rules.treeType;

  if (treeType === 'cactus') {
    // Cactus: 2-3 stacked CACTUS blocks, no leaves.
    const h = 2 + Math.floor(rng() * 2);
    for (let i = 1; i <= h; i++) {
      const yy = groundY - i;
      if (yy >= 0) world[x][yy] = BLOCKS.CACTUS;
    }
    return;
  }

  // Trunk height
  const trunkH = treeType === 'pine' ? 5 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 3);
  for (let i = 1; i <= trunkH; i++) {
    const yy = groundY - i;
    if (yy >= 0) world[x][yy] = BLOCKS.WOOD;
  }

  // Foliage
  const leafBlock = treeType === 'pine' ? BLOCKS.PINE_LEAVES : BLOCKS.LEAVES;
  if (treeType === 'pine') {
    // Narrow conical foliage
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const lx = x + dx;
        const ly = groundY - trunkH + dy - 1;
        if (lx >= 0 && lx < WORLD_WIDTH && ly >= 0 && ly < WORLD_HEIGHT) {
          if (world[lx][ly] === BLOCKS.AIR) world[lx][ly] = leafBlock;
        }
      }
    }
    // Top tip
    const topY = groundY - trunkH - 2;
    if (topY >= 0) world[x][topY] = leafBlock;
  } else {
    // Oak: rounder blob
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 1; dy++) {
        if (Math.abs(dx) + Math.abs(dy) <= 3) {
          const lx = x + dx;
          const ly = groundY - trunkH + dy - 1;
          if (lx >= 0 && lx < WORLD_WIDTH && ly >= 0 && ly < WORLD_HEIGHT) {
            if (world[lx][ly] === BLOCKS.AIR) world[lx][ly] = leafBlock;
          }
        }
      }
    }
  }
}

// MAIN. Builds and returns a 2D array world[x][y] of block IDs.
// Deterministic given the seed.
export function generateWorld(seed) {
  const rng = makeRng(seed);
  const world = [];

  // Initialize every cell to AIR.
  for (let x = 0; x < WORLD_WIDTH; x++) {
    world[x] = new Array(WORLD_HEIGHT);
    for (let y = 0; y < WORLD_HEIGHT; y++) world[x][y] = BLOCKS.AIR;
  }

  // Cache surface heights so trees can find them later.
  const surfaceY = new Array(WORLD_WIDTH);

  // Lay down terrain column-by-column.
  for (let x = 0; x < WORLD_WIDTH; x++) {
    const biome = getBiomeAt(x, seed);
    const rules = getBiomeRules(biome);
    const elevationDelta = getBiomeElevationDelta(x, seed);

    // Base height (preserves original Math.sin profile) + biome delta + small jitter.
    const base = WORLD_HEIGHT / 2 + Math.sin(x * 0.1) * 5;
    const jitter = rng() * 3;
    let height = Math.floor(base + elevationDelta + jitter);

    // Clamp so we never escape the world.
    if (height < 3) height = 3;
    if (height > WORLD_HEIGHT - 2) height = WORLD_HEIGHT - 2;
    surfaceY[x] = height;

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      if (y === WORLD_HEIGHT - 1) {
        world[x][y] = BLOCKS.BEDROCK;
      } else if (y > height + 5) {
        // Deep layer: rare diamond, otherwise the biome's "deep" block.
        if (rng() < 0.02 && y > height + 10) {
          world[x][y] = BLOCKS.DIAMOND;
        } else {
          world[x][y] = rules.deep;
        }
      } else if (y > height) {
        world[x][y] = rules.subSurface;
      } else if (y === height) {
        // Mountain snow-cap: tall peaks get SNOW even if rules say STONE.
        if (biome === 'mountain' && y < 18) {
          world[x][y] = BLOCKS.SNOW;
        } else {
          world[x][y] = rules.surface;
        }
      }
    }
  }

  // Add trees in a second pass so tree leaves can cross zone boundaries safely.
  // Skip the outer 5 cols (parity with original) and skip transition columns.
  for (let x = 5; x < WORLD_WIDTH - 5; x++) {
    if (isTransitionColumn(x)) continue;
    const biome = getBiomeAt(x, seed);
    const rules = getBiomeRules(biome);
    if (rng() < rules.treeChance) {
      placeTree(world, x, surfaceY[x], rules, rng);
    }
  }

  return world;
}
