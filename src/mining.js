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
  },
};

export function getMiningSpeed(tool, blockType) {
  // BEDROCK, AIR, WATER and unknown blocks cannot be mined.
  if (
    blockType === BLOCKS.BEDROCK ||
    blockType === BLOCKS.AIR ||
    blockType === BLOCKS.WATER
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
