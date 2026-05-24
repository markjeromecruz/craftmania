// Stable game data shared by index.html (via window.CraftLogic bridge)
// and Vitest unit tests. Phase 2D extends this with new biome blocks.

export const BLOCK_SIZE = 32;

export const BLOCKS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  DIAMOND: 6,
  SAND: 7,
  WATER: 8,
  BEDROCK: 9,
  CACTUS: 10,
  SNOW: 11,
  ICE: 12,
  PINE_LEAVES: 13,
};

const BLOCK_COLORS = {
  [BLOCKS.GRASS]: '#228B22',
  [BLOCKS.DIRT]: '#8B4513',
  [BLOCKS.STONE]: '#808080',
  [BLOCKS.WOOD]: '#8B4513',
  [BLOCKS.LEAVES]: '#00FF00',
  [BLOCKS.DIAMOND]: '#00FFFF',
  [BLOCKS.SAND]: '#F4A460',
  [BLOCKS.WATER]: '#4169E1',
  [BLOCKS.BEDROCK]: '#1C1C1C',
  [BLOCKS.CACTUS]: '#2E8B57',
  [BLOCKS.SNOW]: '#F0F8FF',
  [BLOCKS.ICE]: '#A5F2F3',
  [BLOCKS.PINE_LEAVES]: '#0B6623',
};

export function getBlockColor(block) {
  return BLOCK_COLORS[block] ?? null;
}
