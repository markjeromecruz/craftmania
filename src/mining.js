// Pure mining and inventory math for Bug 7 (mined blocks vanish) and
// Bug 9 (pickaxe doesn't affect mining speed). The integrator wires these
// into index.html in Phase 3.
import { BLOCKS } from './render-data.js';

export const BASE_MINING_TICKS_TO_COMPLETE = 30;

// Local mirror of Phase 2D block ids so this module behaves correctly even
// before render-data.js is extended. Anything not in BLOCKS or this list is
// treated defensively (unknown → null drop, 0 mining speed).
const CACTUS = 10;
const SNOW = 11;
const ICE = 12;
const PINE_LEAVES = 13;

// Phase 3 biome expansion: mirror new ids 14-40. Agent A adds them to
// render-data.js in parallel; mirroring locally keeps this module independent
// during the parallel build.
const TALL_GRASS = 14, FLOWER_RED = 15, FLOWER_YELLOW = 16, FLOWER_PINK = 17,
      DARK_OAK_WOOD = 18, DARK_OAK_LEAVES = 19, MUSHROOM = 20,
      SPRUCE_WOOD = 21, PODZOL = 22, MOSS_BLOCK = 23,
      JUNGLE_WOOD = 24, JUNGLE_LEAVES = 25, VINE = 26, BAMBOO = 27,
      CHERRY_WOOD = 28, CHERRY_LEAVES = 29,
      PALE_OAK_WOOD = 30, PALE_LEAVES = 31, HANGING_MOSS = 32,
      GRAVEL = 33, AZALEA_LEAVES = 34, GLOW_BERRIES = 35, CLAY = 36,
      DRIPSTONE = 37, POINTED_DRIPSTONE = 38, SCULK = 39, ECHO_BLOCK = 40;

// Mining-update ore + deep block ids (41-46).
const COAL_ORE = 41, IRON_ORE = 42, GOLD_ORE = 43, NETHERITE_ORE = 44,
      LAVA = 45, OBSIDIAN = 46;

// Inventory slot layout from index.html ~256-261:
//   0 stone (placed), 1 wood (placed), 2 pickaxe, 3 sword, 4 food
const SLOT_TO_TOOL = {
  0: 'hand',
  1: 'hand',
  2: 'pickaxe',
  3: 'sword',
  4: 'hand',
};

export function getToolFromSlot(slotIndex) {
  return SLOT_TO_TOOL[slotIndex] ?? 'hand';
}

// Mining speed multiplier table per (tool, block).
// Looked up as SPEED[tool][blockId]; default 0 means cannot mine.
const SPEED = {
  pickaxe: {
    [BLOCKS.STONE]: 2,
    [BLOCKS.DIAMOND]: 2,
    [BLOCKS.DIRT]: 1,
    [BLOCKS.SAND]: 1,
    [BLOCKS.GRASS]: 1,
    [BLOCKS.WOOD]: 1,
    [BLOCKS.LEAVES]: 1,
    [CACTUS]: 1,
    [SNOW]: 2,
    [ICE]: 2,
    [PINE_LEAVES]: 1,
    // Phase 3 biome blocks (14-40)
    [TALL_GRASS]: 1,
    [FLOWER_RED]: 1,
    [FLOWER_YELLOW]: 1,
    [FLOWER_PINK]: 1,
    [DARK_OAK_WOOD]: 1,
    [DARK_OAK_LEAVES]: 1,
    [MUSHROOM]: 1,
    [SPRUCE_WOOD]: 1,
    [PODZOL]: 1,
    [MOSS_BLOCK]: 1,
    [JUNGLE_WOOD]: 1,
    [JUNGLE_LEAVES]: 1,
    [VINE]: 1,
    [BAMBOO]: 1,
    [CHERRY_WOOD]: 1,
    [CHERRY_LEAVES]: 1,
    [PALE_OAK_WOOD]: 1,
    [PALE_LEAVES]: 1,
    [HANGING_MOSS]: 1,
    [GRAVEL]: 1,
    [AZALEA_LEAVES]: 1,
    [GLOW_BERRIES]: 1,
    [CLAY]: 1,
    [DRIPSTONE]: 2,
    [POINTED_DRIPSTONE]: 2,
    [SCULK]: 2,
    [ECHO_BLOCK]: 2,
    // Ores: pickaxe is the right tool. Harder metals take longer.
    [COAL_ORE]: 1.5,
    [IRON_ORE]: 1.2,
    [GOLD_ORE]: 1,
    [NETHERITE_ORE]: 0.8,
    [OBSIDIAN]: 0.4,
  },
  hand: {
    [BLOCKS.STONE]: 0.5,
    [BLOCKS.DIAMOND]: 0.5,
    [BLOCKS.WOOD]: 1,
    [BLOCKS.LEAVES]: 1,
    [BLOCKS.DIRT]: 1,
    [BLOCKS.GRASS]: 1,
    [BLOCKS.SAND]: 1,
    [CACTUS]: 1,
    [SNOW]: 1,
    [ICE]: 0.5,
    [PINE_LEAVES]: 1,
    // Phase 3 biome blocks (14-40)
    [TALL_GRASS]: 1,
    [FLOWER_RED]: 1,
    [FLOWER_YELLOW]: 1,
    [FLOWER_PINK]: 1,
    [DARK_OAK_WOOD]: 1,
    [DARK_OAK_LEAVES]: 1,
    [MUSHROOM]: 1,
    [SPRUCE_WOOD]: 1,
    [PODZOL]: 1,
    [MOSS_BLOCK]: 1,
    [JUNGLE_WOOD]: 1,
    [JUNGLE_LEAVES]: 1,
    [VINE]: 1,
    [BAMBOO]: 1.5,
    [CHERRY_WOOD]: 1,
    [CHERRY_LEAVES]: 1,
    [PALE_OAK_WOOD]: 1,
    [PALE_LEAVES]: 1,
    [HANGING_MOSS]: 1,
    [GRAVEL]: 0.5,
    [AZALEA_LEAVES]: 1,
    [GLOW_BERRIES]: 1,
    [CLAY]: 0.5,
    [DRIPSTONE]: 0.3,
    [POINTED_DRIPSTONE]: 0.3,
    [SCULK]: 0.3,
    [ECHO_BLOCK]: 0.3,
    // Ores barely budge by hand — bring a pickaxe.
    [COAL_ORE]: 0.3,
    [IRON_ORE]: 0.2,
    [GOLD_ORE]: 0.2,
    [NETHERITE_ORE]: 0.1,
    [OBSIDIAN]: 0.05,
  },
  sword: {
    [BLOCKS.STONE]: 0.5,
    [BLOCKS.DIAMOND]: 0.5,
    [BLOCKS.WOOD]: 0.5,
    [BLOCKS.LEAVES]: 0.5,
    [BLOCKS.DIRT]: 0.5,
    [BLOCKS.GRASS]: 0.5,
    [BLOCKS.SAND]: 0.5,
    [CACTUS]: 0.5,
    [SNOW]: 0.5,
    [ICE]: 0.5,
    [PINE_LEAVES]: 0.5,
    // Phase 3 biome blocks (14-40)
    [TALL_GRASS]: 0.5,
    [FLOWER_RED]: 0.5,
    [FLOWER_YELLOW]: 0.5,
    [FLOWER_PINK]: 0.5,
    [DARK_OAK_WOOD]: 0.5,
    [DARK_OAK_LEAVES]: 0.5,
    [MUSHROOM]: 0.5,
    [SPRUCE_WOOD]: 0.5,
    [PODZOL]: 0.5,
    [MOSS_BLOCK]: 0.5,
    [JUNGLE_WOOD]: 0.5,
    [JUNGLE_LEAVES]: 0.5,
    [VINE]: 0.5,
    [BAMBOO]: 0.5,
    [CHERRY_WOOD]: 0.5,
    [CHERRY_LEAVES]: 0.5,
    [PALE_OAK_WOOD]: 0.5,
    [PALE_LEAVES]: 0.5,
    [HANGING_MOSS]: 0.5,
    [GRAVEL]: 0.5,
    [AZALEA_LEAVES]: 0.5,
    [GLOW_BERRIES]: 0.5,
    [CLAY]: 0.5,
    [DRIPSTONE]: 0.3,
    [POINTED_DRIPSTONE]: 0.3,
    [SCULK]: 0.3,
    [ECHO_BLOCK]: 0.3,
    [COAL_ORE]: 0.3,
    [IRON_ORE]: 0.3,
    [GOLD_ORE]: 0.3,
    [NETHERITE_ORE]: 0.3,
    [OBSIDIAN]: 0.1,
  },
};

export function getMiningSpeed(tool, blockType) {
  // BEDROCK, AIR, WATER, LAVA and unknown blocks cannot be mined.
  if (
    blockType === BLOCKS.BEDROCK ||
    blockType === BLOCKS.AIR ||
    blockType === BLOCKS.WATER ||
    blockType === LAVA
  ) {
    return 0;
  }
  const table = SPEED[tool];
  if (!table) return 0;
  return table[blockType] ?? 0;
}

export function applyMiningTick(progress, blockType, tool) {
  const speed = getMiningSpeed(tool, blockType);
  if (speed <= 0) {
    return { progress, completed: false };
  }
  const next = progress + speed;
  return {
    progress: next,
    completed: next >= BASE_MINING_TICKS_TO_COMPLETE,
  };
}

// What does this block drop when mined?
// stone-like rubble → 'stone'; wood-like → 'wood'; diamond is special.
const DROPS = {
  [BLOCKS.STONE]: { item: 'stone', count: 1 },
  [BLOCKS.DIRT]: { item: 'stone', count: 1 },
  [BLOCKS.SAND]: { item: 'stone', count: 1 },
  [BLOCKS.GRASS]: { item: 'stone', count: 1 },
  [BLOCKS.WOOD]: { item: 'wood', count: 1 },
  [BLOCKS.LEAVES]: null,
  [BLOCKS.DIAMOND]: { item: 'diamond', count: 1 },
  [BLOCKS.AIR]: null,
  [BLOCKS.WATER]: null,
  [BLOCKS.BEDROCK]: null,
  [CACTUS]: { item: 'wood', count: 1 },
  [SNOW]: { item: 'stone', count: 1 },
  [ICE]: { item: 'stone', count: 1 },
  [PINE_LEAVES]: null,
  // Phase 3 biome blocks (14-40). Decorative flora drops null; wood-like blocks
  // drop wood; stone-like/cave blocks drop stone; sculk/echo drop nothing
  // (deep dark is eerie — silenced by the warden's presence).
  [TALL_GRASS]: null,
  [FLOWER_RED]: null,
  [FLOWER_YELLOW]: null,
  [FLOWER_PINK]: null,
  [DARK_OAK_WOOD]: { item: 'wood', count: 1 },
  [DARK_OAK_LEAVES]: null,
  [MUSHROOM]: null,
  [SPRUCE_WOOD]: { item: 'wood', count: 1 },
  [PODZOL]: { item: 'stone', count: 1 },
  [MOSS_BLOCK]: { item: 'stone', count: 1 },
  [JUNGLE_WOOD]: { item: 'wood', count: 1 },
  [JUNGLE_LEAVES]: null,
  [VINE]: null,
  [BAMBOO]: { item: 'wood', count: 1 },
  [CHERRY_WOOD]: { item: 'wood', count: 1 },
  [CHERRY_LEAVES]: null,
  [PALE_OAK_WOOD]: { item: 'wood', count: 1 },
  [PALE_LEAVES]: null,
  [HANGING_MOSS]: null,
  [GRAVEL]: { item: 'stone', count: 1 },
  [AZALEA_LEAVES]: null,
  [GLOW_BERRIES]: null,
  [CLAY]: { item: 'stone', count: 1 },
  [DRIPSTONE]: { item: 'stone', count: 1 },
  [POINTED_DRIPSTONE]: { item: 'stone', count: 1 },
  [SCULK]: null,
  [ECHO_BLOCK]: null,
  // Ores drop their material (routed to the resources panel by the integrator).
  [COAL_ORE]: { item: 'coal', count: 1 },
  [IRON_ORE]: { item: 'iron', count: 1 },
  [GOLD_ORE]: { item: 'gold', count: 1 },
  [NETHERITE_ORE]: { item: 'netherite', count: 1 },
  [OBSIDIAN]: { item: 'obsidian', count: 1 },
  [LAVA]: null,
};

export function getBlockDrop(blockType) {
  if (!(blockType in DROPS)) return null;
  return DROPS[blockType];
}

// Item → inventory slot index. pickaxe/sword/diamond intentionally absent:
// pickaxe/sword can't be dropped by mining, and diamond is tracked separately
// on gameState.diamonds by the integrator.
const ITEM_TO_SLOT = {
  stone: 0,
  wood: 1,
  food: 4,
};

export function addToInventory(inventory, item, count) {
  const slot = ITEM_TO_SLOT[item];
  // Return a shallow-cloned inventory either way so callers can rely on
  // immutability semantics.
  const nextItems = inventory.items.map((s) => ({ ...s }));
  if (slot !== undefined) {
    nextItems[slot] = {
      ...nextItems[slot],
      count: nextItems[slot].count + count,
    };
  }
  return {
    ...inventory,
    items: nextItems,
  };
}
