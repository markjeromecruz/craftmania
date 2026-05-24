import { BLOCKS } from './render-data.js';

// World dimensions and biome layout.
export const WORLD_WIDTH = 600;
export const WORLD_HEIGHT = 80;
// Average / default zone width. Variable per-biome widths are the source of truth;
// this is exposed for any consumer that needs a coarse single number.
export const DEFAULT_ZONE_WIDTH = 40;

// Cave biome thresholds (constants only; implementation lives in cave overlay).
export const CAVE_BIOME_START_Y = 50;
export const DEEP_DARK_START_Y = 65;

// Local mirror of new biome BLOCK ids (Agent A is adding these to render-data.js
// in parallel; we reference them by numeric id here for safety). Once Agent A's
// commit lands the integrator can swap this mirror for the real BLOCKS import.
const NEW_BLOCKS = {
  TALL_GRASS: 14,
  FLOWER_RED: 15,
  FLOWER_YELLOW: 16,
  FLOWER_PINK: 17,
  DARK_OAK_WOOD: 18,
  DARK_OAK_LEAVES: 19,
  MUSHROOM: 20,
  SPRUCE_WOOD: 21,
  PODZOL: 22,
  MOSS_BLOCK: 23,
  JUNGLE_WOOD: 24,
  JUNGLE_LEAVES: 25,
  VINE: 26,
  BAMBOO: 27,
  CHERRY_WOOD: 28,
  CHERRY_LEAVES: 29,
  PALE_OAK_WOOD: 30,
  PALE_LEAVES: 31,
  HANGING_MOSS: 32,
  GRAVEL: 33,
  AZALEA_LEAVES: 34,
  GLOW_BERRIES: 35,
  CLAY: 36,
  DRIPSTONE: 37,
  POINTED_DRIPSTONE: 38,
  SCULK: 39,
  ECHO_BLOCK: 40,
  // Mirror of existing ids we reference symbolically below.
  SNOW: 11,
};

// Surface biome list. `river` and `beach` come from Agent C's river overlay
// (not in the weighted picker).
export const BIOMES = [
  'plains', 'forest', 'taiga', 'desert', 'snow', 'mountain',
  'jungle', 'dark_forest', 'flower_forest', 'bamboo_jungle',
  'old_growth_taiga', 'cherry_grove', 'pale_garden',
];

// Cumulative-weight selection table. Higher = more common. Total = 59.
export const BIOME_WEIGHTS = {
  plains: 10, forest: 10, taiga: 8, desert: 6, snow: 6, mountain: 5,
  jungle: 3, dark_forest: 3, flower_forest: 2, bamboo_jungle: 2,
  old_growth_taiga: 2, cherry_grove: 1, pale_garden: 1,
};

// Per-biome zone width range. `buildZoneTable` picks a width in
// [minW, maxW] inclusive when laying down each zone.
export const BIOME_WIDTHS = {
  plains:           { minW: 40, maxW: 80 },
  forest:           { minW: 40, maxW: 70 },
  taiga:            { minW: 35, maxW: 65 },
  desert:           { minW: 30, maxW: 60 },
  snow:             { minW: 30, maxW: 60 },
  mountain:         { minW: 25, maxW: 50 },
  jungle:           { minW: 25, maxW: 45 },
  dark_forest:      { minW: 25, maxW: 45 },
  flower_forest:    { minW: 20, maxW: 35 },
  bamboo_jungle:    { minW: 20, maxW: 35 },
  old_growth_taiga: { minW: 20, maxW: 35 },
  cherry_grove:     { minW: 15, maxW: 30 },
  pale_garden:      { minW: 15, maxW: 30 },
};

// Per-biome generation rules. Keys mirror BIOMES.
export const BIOME_RULES = {
  plains:           { surface: BLOCKS.GRASS,           subSurface: BLOCKS.DIRT,           deep: BLOCKS.STONE, elevationDelta: 0,  treeChance: 0.10, treeType: 'oak'     },
  desert:           { surface: BLOCKS.SAND,            subSurface: BLOCKS.SAND,           deep: BLOCKS.STONE, elevationDelta: -3, treeChance: 0.04, treeType: 'cactus'  },
  forest:           { surface: BLOCKS.GRASS,           subSurface: BLOCKS.DIRT,           deep: BLOCKS.STONE, elevationDelta: 1,  treeChance: 0.30, treeType: 'oak'     },
  mountain:         { surface: BLOCKS.STONE,           subSurface: BLOCKS.STONE,          deep: BLOCKS.STONE, elevationDelta: 8,  treeChance: 0.02, treeType: 'oak'     },
  snow:             { surface: BLOCKS.SNOW,            subSurface: BLOCKS.DIRT,           deep: BLOCKS.STONE, elevationDelta: 2,  treeChance: 0.12, treeType: 'pine'    },
  taiga:            { surface: BLOCKS.GRASS,           subSurface: NEW_BLOCKS.PODZOL,     deep: BLOCKS.STONE, elevationDelta: 2,  treeChance: 0.25, treeType: 'spruce'  },
  old_growth_taiga: { surface: NEW_BLOCKS.MOSS_BLOCK,  subSurface: NEW_BLOCKS.PODZOL,     deep: BLOCKS.STONE, elevationDelta: 3,  treeChance: 0.35, treeType: 'spruce'  },
  jungle:           { surface: BLOCKS.GRASS,           subSurface: BLOCKS.DIRT,           deep: BLOCKS.STONE, elevationDelta: 2,  treeChance: 0.40, treeType: 'jungle'  },
  bamboo_jungle:    { surface: BLOCKS.GRASS,           subSurface: BLOCKS.DIRT,           deep: BLOCKS.STONE, elevationDelta: 2,  treeChance: 0.50, treeType: 'bamboo'  },
  flower_forest:    { surface: BLOCKS.GRASS,           subSurface: BLOCKS.DIRT,           deep: BLOCKS.STONE, elevationDelta: 1,  treeChance: 0.20, treeType: 'oak',      flowerChance: 0.35 },
  dark_forest:      { surface: BLOCKS.GRASS,           subSurface: BLOCKS.DIRT,           deep: BLOCKS.STONE, elevationDelta: 0,  treeChance: 0.45, treeType: 'dark_oak', mushroomChance: 0.05 },
  cherry_grove:     { surface: BLOCKS.GRASS,           subSurface: BLOCKS.DIRT,           deep: BLOCKS.STONE, elevationDelta: 4,  treeChance: 0.30, treeType: 'cherry'  },
  pale_garden:      { surface: BLOCKS.GRASS,           subSurface: BLOCKS.DIRT,           deep: BLOCKS.STONE, elevationDelta: 1,  treeChance: 0.35, treeType: 'pale'    },
};

// Returns the rules object for the given biome name. Falls back to plains.
export function getBiomeRules(biome) {
  return BIOME_RULES[biome] ?? BIOME_RULES.plains;
}

// Tiny deterministic hash (xorshift32-ish) of a 32-bit unsigned int.
// Same input -> same output across runs.
function hash32(n) {
  let x = n | 0;
  x = (x ^ 0x9E3779B9) | 0;
  x = (x ^ (x << 13)) | 0;
  x = (x ^ (x >>> 17)) | 0;
  x = (x ^ (x << 5)) | 0;
  return x >>> 0;  // unsigned
}

// Mulberry32 PRNG factory. Same seed -> same sequence.
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

// ---------------------------------------------------------------------------
// Cave biome layer — biome-flavoured sprinkle of blocks into deep stone.
// CAVE_BIOME_START_Y and DEEP_DARK_START_Y come from B (already exported).
// ---------------------------------------------------------------------------
export const CAVE_ZONE_WIDTH = 30;
export const CAVE_BLOCK_SPRINKLE_CHANCE = 0.06;

// Local mirror of new biome block ids (the parallel agents are also
// adding these to src/render-data.js; for parallel-safety we use numerics).
const MOSS_BLOCK = 23;
const AZALEA_LEAVES = 34;
const GLOW_BERRIES = 35;
const CLAY = 36;
const DRIPSTONE = 37;
const POINTED_DRIPSTONE = 38;
const SCULK = 39;
const ECHO_BLOCK = 40;

// Pure: same (x, y, seed) -> same return.
// Returns 'lush' | 'dripstone' | 'deep_dark' | null. Cave biomes are zoned
// horizontally (CAVE_ZONE_WIDTH cols each) and only exist below
// CAVE_BIOME_START_Y. 'deep_dark' is gated behind DEEP_DARK_START_Y.
export function getCaveBiomeAt(x, y, seed) {
  if (y <= CAVE_BIOME_START_Y) return null;
  const zoneIndex = Math.floor(x / CAVE_ZONE_WIDTH);
  // Use distinct hash constants so cave zones don't correlate with surface.
  const combined = ((seed >>> 0) * 2246822519 + zoneIndex * 3266489917) >>> 0;
  const h = hash32(combined);
  const r = h % 100;
  if (y > DEEP_DARK_START_Y && r < 25) return 'deep_dark';
  if (r < 35) return 'lush';
  if (r < 70) return 'dripstone';
  return null;
}

// Pure helper for the column-fill loop: returns a block to write or null
// (caller writes rules.deep instead). Uses caller's rng (so per-cell
// determinism is preserved across the whole generateWorld call).
function pickCaveBlock(caveBiome, rng) {
  if (caveBiome === 'lush') {
    const v = rng();
    if (v < 0.10) return GLOW_BERRIES;
    if (v < 0.30) return AZALEA_LEAVES;
    if (v < 0.55) return CLAY;
    return MOSS_BLOCK;
  }
  if (caveBiome === 'dripstone') {
    return rng() < 0.20 ? POINTED_DRIPSTONE : DRIPSTONE;
  }
  if (caveBiome === 'deep_dark') {
    return rng() < 0.10 ? ECHO_BLOCK : SCULK;
  }
  return null;
}

// ---------------------------------------------------------------------------
// River + beach overlay — 3 deterministic cut-through rivers per world.
// ---------------------------------------------------------------------------
export const NUM_RIVERS = 3;
export const RIVER_MIN_WIDTH = 4;
export const RIVER_MAX_WIDTH = 8;
export const BEACH_WIDTH = 3;
export const RIVER_DEPTH_BELOW = 3;

// Pure: derives river plan from seed. Returns NUM_RIVERS objects of the
// form { centerX, width }, each centered at least 40 cols from either edge.
export function getRiverPlan(seed) {
  const rivers = [];
  for (let i = 0; i < NUM_RIVERS; i++) {
    const h1 = hash32(((seed >>> 0) * 16777619 + i * 2166136261) >>> 0);
    const h2 = hash32(((seed >>> 0) * 374761393 + i * 2654435761) >>> 0);
    const safeSpan = WORLD_WIDTH - 80;  // 40-col margin each side
    const centerX = 40 + (h1 % safeSpan);
    const width = RIVER_MIN_WIDTH + (h2 % (RIVER_MAX_WIDTH - RIVER_MIN_WIDTH + 1));
    rivers.push({ centerX, width });
  }
  return rivers;
}

// Pure: returns 'water' | 'beach' | null for col x given a river plan.
// 'water' is the central band of width `r.width` (centered on r.centerX).
// 'beach' is BEACH_WIDTH cols immediately to either side of the water band.
export function riverColumnRole(x, plan) {
  for (const r of plan) {
    const halfW = Math.floor(r.width / 2);
    const waterL = r.centerX - halfW;
    const waterR = r.centerX + halfW;
    if (x >= waterL && x <= waterR) return 'water';
    if (x >= waterL - BEACH_WIDTH && x < waterL) return 'beach';
    if (x > waterR && x <= waterR + BEACH_WIDTH) return 'beach';
  }
  return null;
}

// Cumulative-weight biome picker. Pure: depends only on (seed, zoneIndex).
// Hashes (seed, zoneIndex) to a stable [0, totalWeight) integer and walks
// BIOME_WEIGHTS in BIOMES order until it lands inside a bucket.
export function pickWeightedBiome(seed, zoneIndex) {
  let total = 0;
  for (const b of BIOMES) total += BIOME_WEIGHTS[b];

  const combined = ((seed >>> 0) * 2654435761 + zoneIndex * 374761393) >>> 0;
  const h = hash32(combined);
  const pick = h % total;

  let acc = 0;
  for (const b of BIOMES) {
    acc += BIOME_WEIGHTS[b];
    if (pick < acc) return b;
  }
  // Defensive fallback (should be unreachable).
  return BIOMES[BIOMES.length - 1];
}

// Builds the per-seed zone table from scratch (no memoization).
// Walks left-to-right picking weighted biomes and choosing a width within
// BIOME_WIDTHS[biome]. The last zone is trimmed so endX === WORLD_WIDTH.
export function buildZoneTable(seed) {
  const table = [];
  // Use a separate RNG seeded from `seed` so width jitter is deterministic
  // and independent of the rng used inside generateWorld.
  const rng = makeRng(hash32(((seed >>> 0) ^ 0xA5A5A5A5) >>> 0));

  let startX = 0;
  let zoneIndex = 0;
  while (startX < WORLD_WIDTH) {
    const biome = pickWeightedBiome(seed, zoneIndex);
    const { minW, maxW } = BIOME_WIDTHS[biome];
    const span = maxW - minW + 1;
    const width = minW + Math.floor(rng() * span);
    let endX = startX + width;
    if (endX > WORLD_WIDTH) endX = WORLD_WIDTH;
    table.push({ startX, endX, biome });
    startX = endX;
    zoneIndex++;
  }
  return table;
}

// Memoized zone-table cache keyed by seed.
const ZONE_TABLE_CACHE = new Map();
export function getZoneTable(seed) {
  const key = seed >>> 0;
  let table = ZONE_TABLE_CACHE.get(key);
  if (!table) {
    table = buildZoneTable(seed);
    ZONE_TABLE_CACHE.set(key, table);
  }
  return table;
}

// Binary search for the zone whose [startX, endX) contains x.
function findZoneIndex(table, x) {
  let lo = 0;
  let hi = table.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const zone = table[mid];
    if (x < zone.startX) {
      hi = mid - 1;
    } else if (x >= zone.endX) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  // Clamp out-of-range x to the nearest end zone (defensive).
  if (x < 0) return 0;
  return table.length - 1;
}

// Returns the biome name for column x given a world seed. Deterministic.
export function getBiomeAt(x, seed) {
  const table = getZoneTable(seed);
  const idx = findZoneIndex(table, x);
  return table[idx].biome;
}

// A column is a "transition column" if it sits within 2 of either zone
// boundary (i.e. <= startX+1 or >= endX-2 of the zone that contains it).
export function isTransitionColumn(x, seed) {
  const table = getZoneTable(seed);
  const idx = findZoneIndex(table, x);
  const zone = table[idx];
  return x <= zone.startX + 1 || x >= zone.endX - 2;
}

// Smoothed elevation delta. At interior cols returns this biome's delta;
// at transition cols averages with the adjacent zone's delta.
export function getBiomeElevationDelta(x, seed) {
  const table = getZoneTable(seed);
  const idx = findZoneIndex(table, x);
  const zone = table[idx];
  const myDelta = getBiomeRules(zone.biome).elevationDelta;

  if (!isTransitionColumn(x, seed)) return myDelta;

  // Decide which neighbor we are transitioning toward.
  let neighborIdx;
  if (x <= zone.startX + 1) {
    neighborIdx = idx - 1; // left edge -> left neighbor
  } else {
    neighborIdx = idx + 1; // right edge -> right neighbor
  }

  // At the world's outer edges there is no neighbor — return self.
  if (neighborIdx < 0 || neighborIdx >= table.length) return myDelta;

  const neighborBiome = table[neighborIdx].biome;
  const neighborDelta = getBiomeRules(neighborBiome).elevationDelta;
  return (myDelta + neighborDelta) / 2;
}

// Place a tree at column x with its base on top of `groundY`.
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

  if (treeType === 'bamboo') {
    // Bamboo: 4-7 vertical BAMBOO blocks, no leaves.
    const h = 4 + Math.floor(rng() * 4);
    for (let i = 1; i <= h; i++) {
      const yy = groundY - i;
      if (yy >= 0) world[x][yy] = NEW_BLOCKS.BAMBOO;
    }
    return;
  }

  // Pick trunk block + leaf block + trunk height per tree type.
  let trunkBlock = BLOCKS.WOOD;
  let leafBlock = BLOCKS.LEAVES;
  let trunkH;
  switch (treeType) {
    case 'pine':
      trunkBlock = BLOCKS.WOOD;
      leafBlock = BLOCKS.PINE_LEAVES;
      trunkH = 5 + Math.floor(rng() * 2);
      break;
    case 'spruce':
      trunkBlock = NEW_BLOCKS.SPRUCE_WOOD;
      leafBlock = BLOCKS.PINE_LEAVES;
      trunkH = 5 + Math.floor(rng() * 3);
      break;
    case 'dark_oak':
      trunkBlock = NEW_BLOCKS.DARK_OAK_WOOD;
      leafBlock = NEW_BLOCKS.DARK_OAK_LEAVES;
      trunkH = 6 + Math.floor(rng() * 3);
      break;
    case 'jungle':
      trunkBlock = NEW_BLOCKS.JUNGLE_WOOD;
      leafBlock = NEW_BLOCKS.JUNGLE_LEAVES;
      trunkH = 7 + Math.floor(rng() * 4);
      break;
    case 'cherry':
      trunkBlock = NEW_BLOCKS.CHERRY_WOOD;
      leafBlock = NEW_BLOCKS.CHERRY_LEAVES;
      trunkH = 4 + Math.floor(rng() * 3);
      break;
    case 'pale':
      trunkBlock = NEW_BLOCKS.PALE_OAK_WOOD;
      leafBlock = NEW_BLOCKS.PALE_LEAVES;
      trunkH = 4 + Math.floor(rng() * 3);
      break;
    case 'oak':
    default:
      trunkBlock = BLOCKS.WOOD;
      leafBlock = BLOCKS.LEAVES;
      trunkH = 4 + Math.floor(rng() * 3);
      break;
  }

  for (let i = 1; i <= trunkH; i++) {
    const yy = groundY - i;
    if (yy >= 0) world[x][yy] = trunkBlock;
  }

  // Foliage shape depends on tree type.
  if (treeType === 'pine' || treeType === 'spruce') {
    // Narrow conical foliage (slightly fatter for spruce — uses same pattern).
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const lx = x + dx;
        const ly = groundY - trunkH + dy - 1;
        if (lx >= 0 && lx < WORLD_WIDTH && ly >= 0 && ly < WORLD_HEIGHT) {
          if (world[lx][ly] === BLOCKS.AIR) world[lx][ly] = leafBlock;
        }
      }
    }
    // Top tip.
    const topY = groundY - trunkH - 2;
    if (topY >= 0) world[x][topY] = leafBlock;
  } else if (treeType === 'jungle') {
    // Wider blob + occasional dangling VINE blocks.
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
    // Vine dangle from the left/right canopy edges.
    for (const dx of [-2, 2]) {
      const lx = x + dx;
      if (lx >= 0 && lx < WORLD_WIDTH && rng() < 0.5) {
        const startY = groundY - trunkH;
        const vineH = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < vineH; i++) {
          const ly = startY + i;
          if (ly >= 0 && ly < WORLD_HEIGHT && world[lx][ly] === BLOCKS.AIR) {
            world[lx][ly] = NEW_BLOCKS.VINE;
          }
        }
      }
    }
  } else if (treeType === 'cherry') {
    // Round, slightly wide pink canopy.
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
  } else if (treeType === 'pale') {
    // Round canopy + occasional HANGING_MOSS dangle.
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
    for (const dx of [-1, 0, 1]) {
      const lx = x + dx;
      if (lx >= 0 && lx < WORLD_WIDTH && rng() < 0.3) {
        const ly = groundY - trunkH;
        if (ly >= 0 && ly < WORLD_HEIGHT && world[lx][ly] === BLOCKS.AIR) {
          world[lx][ly] = NEW_BLOCKS.HANGING_MOSS;
        }
      }
    }
  } else if (treeType === 'dark_oak') {
    // Taller, darker blob with a denser canopy.
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -3; dy <= 1; dy++) {
        if (Math.abs(dx) + Math.abs(dy) <= 4) {
          const lx = x + dx;
          const ly = groundY - trunkH + dy - 1;
          if (lx >= 0 && lx < WORLD_WIDTH && ly >= 0 && ly < WORLD_HEIGHT) {
            if (world[lx][ly] === BLOCKS.AIR) world[lx][ly] = leafBlock;
          }
        }
      }
    }
  } else {
    // Oak (default): rounder blob.
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

  // Column fill with weighted biomes + variable zones.
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
        // Cave-biome sprinkle FIRST so its rng pull happens before the diamond
        // check — preserves determinism across the whole generateWorld call.
        const caveBiome = getCaveBiomeAt(x, y, seed);
        if (caveBiome && rng() < CAVE_BLOCK_SPRINKLE_CHANCE) {
          world[x][y] = pickCaveBlock(caveBiome, rng);
        } else if (rng() < 0.02 && y > height + 10) {
          world[x][y] = BLOCKS.DIAMOND;
        } else {
          world[x][y] = rules.deep;
        }
      } else if (y > height) {
        world[x][y] = rules.subSurface;
      } else if (y === height) {
        if (biome === 'mountain' && y < 18) {
          world[x][y] = NEW_BLOCKS.SNOW;  // mountain snow cap (uses SNOW id=11)
        } else {
          world[x][y] = rules.surface;
        }
      }
    }
  }

  // River + beach overlay. Pure (no rng) — derives from seed via hash32.
  const riverPlan = getRiverPlan(seed);
  for (let x = 0; x < WORLD_WIDTH; x++) {
    const role = riverColumnRole(x, riverPlan);
    if (!role) continue;
    const surfH = surfaceY[x];
    if (role === 'water') {
      for (let y = surfH; y <= surfH + RIVER_DEPTH_BELOW; y++) {
        if (y < WORLD_HEIGHT - 1) world[x][y] = BLOCKS.WATER;
      }
      // Lower registered surface so the tree pass naturally skips
      surfaceY[x] = surfH + RIVER_DEPTH_BELOW;
    } else {
      // beach — overwrite surface row + one below with sand
      if (surfH < WORLD_HEIGHT) world[x][surfH] = BLOCKS.SAND;
      if (surfH + 1 < WORLD_HEIGHT) world[x][surfH + 1] = BLOCKS.SAND;
    }
  }

  // Tree pass — skip transition cols and any river/beach column.
  for (let x = 5; x < WORLD_WIDTH - 5; x++) {
    if (isTransitionColumn(x, seed)) continue;
    if (riverColumnRole(x, riverPlan) !== null) continue;
    const biome = getBiomeAt(x, seed);
    const rules = getBiomeRules(biome);
    if (rng() < rules.treeChance) {
      placeTree(world, x, surfaceY[x], rules, rng);
    }
  }

  return world;
}
