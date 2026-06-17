import { describe, test, expect } from 'vitest';
import { BLOCKS } from '../src/render-data.js';
import {
  BASE_MINING_TICKS_TO_COMPLETE,
  getToolFromSlot,
  getMiningSpeed,
  applyMiningTick,
  getBlockDrop,
  addToInventory,
} from '../src/mining.js';

const makeInventory = () => ({
  selected: 0,
  items: [
    { type: 'stone', count: 0 },
    { type: 'wood', count: 0 },
    { type: 'pickaxe', count: 1 },
    { type: 'sword', count: 1 },
    { type: 'food', count: 0 },
  ],
});

describe('getToolFromSlot', () => {
  test('slot 0 (stone) is hand', () => {
    expect(getToolFromSlot(0)).toBe('hand');
  });
  test('slot 1 (wood) is hand', () => {
    expect(getToolFromSlot(1)).toBe('hand');
  });
  test('slot 2 is pickaxe', () => {
    expect(getToolFromSlot(2)).toBe('pickaxe');
  });
  test('slot 3 is sword', () => {
    expect(getToolFromSlot(3)).toBe('sword');
  });
  test('slot 4 (food) is hand', () => {
    expect(getToolFromSlot(4)).toBe('hand');
  });
  test('unknown slot index defaults to hand', () => {
    expect(getToolFromSlot(99)).toBe('hand');
    expect(getToolFromSlot(-1)).toBe('hand');
    expect(getToolFromSlot(undefined)).toBe('hand');
  });
});

describe('getMiningSpeed', () => {
  test('pickaxe on STONE is 2.0', () => {
    expect(getMiningSpeed('pickaxe', BLOCKS.STONE)).toBe(2);
  });
  test('pickaxe on DIAMOND is 2.0', () => {
    expect(getMiningSpeed('pickaxe', BLOCKS.DIAMOND)).toBe(2);
  });
  test('pickaxe on DIRT is 1.0', () => {
    expect(getMiningSpeed('pickaxe', BLOCKS.DIRT)).toBe(1);
  });
  test('hand on STONE is 0.5', () => {
    expect(getMiningSpeed('hand', BLOCKS.STONE)).toBe(0.5);
  });
  test('hand on WOOD is 1.0', () => {
    expect(getMiningSpeed('hand', BLOCKS.WOOD)).toBe(1);
  });
  test('sword on STONE is 0.5', () => {
    expect(getMiningSpeed('sword', BLOCKS.STONE)).toBe(0.5);
  });
  test('any tool on BEDROCK is 0', () => {
    expect(getMiningSpeed('pickaxe', BLOCKS.BEDROCK)).toBe(0);
    expect(getMiningSpeed('hand', BLOCKS.BEDROCK)).toBe(0);
    expect(getMiningSpeed('sword', BLOCKS.BEDROCK)).toBe(0);
  });
  test('unknown block returns 0', () => {
    expect(getMiningSpeed('pickaxe', 999)).toBe(0);
  });
});

describe('applyMiningTick', () => {
  test('pickaxe on STONE from 0 → progress 2, not completed', () => {
    expect(applyMiningTick(0, BLOCKS.STONE, 'pickaxe')).toEqual({
      progress: 2,
      completed: false,
    });
  });
  test('pickaxe on STONE from 29 → progress 31, completed', () => {
    expect(applyMiningTick(29, BLOCKS.STONE, 'pickaxe')).toEqual({
      progress: 31,
      completed: true,
    });
  });
  test('hand on STONE from 28 → progress 28.5, not completed', () => {
    expect(applyMiningTick(28, BLOCKS.STONE, 'hand')).toEqual({
      progress: 28.5,
      completed: false,
    });
  });
  test('pickaxe on BEDROCK → progress unchanged, not completed', () => {
    expect(applyMiningTick(0, BLOCKS.BEDROCK, 'pickaxe')).toEqual({
      progress: 0,
      completed: false,
    });
    expect(applyMiningTick(15, BLOCKS.BEDROCK, 'pickaxe')).toEqual({
      progress: 15,
      completed: false,
    });
  });
  test('exact threshold completes', () => {
    expect(applyMiningTick(BASE_MINING_TICKS_TO_COMPLETE - 1, BLOCKS.WOOD, 'hand')).toEqual({
      progress: BASE_MINING_TICKS_TO_COMPLETE,
      completed: true,
    });
  });
});

describe('getBlockDrop', () => {
  test('WOOD drops wood', () => {
    expect(getBlockDrop(BLOCKS.WOOD)).toEqual({ item: 'wood', count: 1 });
  });
  test('LEAVES drop nothing', () => {
    expect(getBlockDrop(BLOCKS.LEAVES)).toBeNull();
  });
  test('DIAMOND drops diamond', () => {
    expect(getBlockDrop(BLOCKS.DIAMOND)).toEqual({ item: 'diamond', count: 1 });
  });
  test('STONE/DIRT/SAND/GRASS drop stone', () => {
    expect(getBlockDrop(BLOCKS.STONE)).toEqual({ item: 'stone', count: 1 });
    expect(getBlockDrop(BLOCKS.DIRT)).toEqual({ item: 'stone', count: 1 });
    expect(getBlockDrop(BLOCKS.SAND)).toEqual({ item: 'stone', count: 1 });
    expect(getBlockDrop(BLOCKS.GRASS)).toEqual({ item: 'stone', count: 1 });
  });
  test('AIR/WATER/BEDROCK drop nothing', () => {
    expect(getBlockDrop(BLOCKS.AIR)).toBeNull();
    expect(getBlockDrop(BLOCKS.WATER)).toBeNull();
    expect(getBlockDrop(BLOCKS.BEDROCK)).toBeNull();
  });
  test('unknown block id drops null (defensive)', () => {
    expect(getBlockDrop(99)).toBeNull();
  });
  test('phase 2D new blocks: CACTUS=10 drops wood; SNOW=11/ICE=12 drop stone; PINE_LEAVES=13 drops null', () => {
    expect(getBlockDrop(10)).toEqual({ item: 'wood', count: 1 });
    expect(getBlockDrop(11)).toEqual({ item: 'stone', count: 1 });
    expect(getBlockDrop(12)).toEqual({ item: 'stone', count: 1 });
    expect(getBlockDrop(13)).toBeNull();
  });
});

// --- Biome expansion (Phase 3): new blocks 14-40 -----------------------------
// Source-of-truth table. (id, name, pickSpeed, handSpeed, swordSpeed, drop)
const BIOME_BLOCK_TABLE = [
  [14, 'TALL_GRASS',        1,   1,   0.5, null],
  [15, 'FLOWER_RED',        1,   1,   0.5, null],
  [16, 'FLOWER_YELLOW',     1,   1,   0.5, null],
  [17, 'FLOWER_PINK',       1,   1,   0.5, null],
  [18, 'DARK_OAK_WOOD',     1,   1,   0.5, { item: 'wood',  count: 1 }],
  [19, 'DARK_OAK_LEAVES',   1,   1,   0.5, null],
  [20, 'MUSHROOM',          1,   1,   0.5, null],
  [21, 'SPRUCE_WOOD',       1,   1,   0.5, { item: 'wood',  count: 1 }],
  [22, 'PODZOL',            1,   1,   0.5, { item: 'stone', count: 1 }],
  [23, 'MOSS_BLOCK',        1,   1,   0.5, { item: 'stone', count: 1 }],
  [24, 'JUNGLE_WOOD',       1,   1,   0.5, { item: 'wood',  count: 1 }],
  [25, 'JUNGLE_LEAVES',     1,   1,   0.5, null],
  [26, 'VINE',              1,   1,   0.5, null],
  [27, 'BAMBOO',            1,   1.5, 0.5, { item: 'wood',  count: 1 }],
  [28, 'CHERRY_WOOD',       1,   1,   0.5, { item: 'wood',  count: 1 }],
  [29, 'CHERRY_LEAVES',     1,   1,   0.5, null],
  [30, 'PALE_OAK_WOOD',     1,   1,   0.5, { item: 'wood',  count: 1 }],
  [31, 'PALE_LEAVES',       1,   1,   0.5, null],
  [32, 'HANGING_MOSS',      1,   1,   0.5, null],
  [33, 'GRAVEL',            1,   0.5, 0.5, { item: 'stone', count: 1 }],
  [34, 'AZALEA_LEAVES',     1,   1,   0.5, null],
  [35, 'GLOW_BERRIES',      1,   1,   0.5, null],
  [36, 'CLAY',              1,   0.5, 0.5, { item: 'stone', count: 1 }],
  [37, 'DRIPSTONE',         2,   0.3, 0.3, { item: 'stone', count: 1 }],
  [38, 'POINTED_DRIPSTONE', 2,   0.3, 0.3, { item: 'stone', count: 1 }],
  [39, 'SCULK',             2,   0.3, 0.3, null],
  [40, 'ECHO_BLOCK',        2,   0.3, 0.3, null],
];

describe('biome expansion: getMiningSpeed for new blocks 14-40', () => {
  for (const [id, name, pickSpeed, handSpeed, swordSpeed] of BIOME_BLOCK_TABLE) {
    test(`pickaxe on ${name}(${id}) = ${pickSpeed}`, () => {
      expect(getMiningSpeed('pickaxe', id)).toBe(pickSpeed);
    });
    test(`hand on ${name}(${id}) = ${handSpeed}`, () => {
      expect(getMiningSpeed('hand', id)).toBe(handSpeed);
    });
    test(`sword on ${name}(${id}) = ${swordSpeed}`, () => {
      expect(getMiningSpeed('sword', id)).toBe(swordSpeed);
    });
  }
});

describe('biome expansion: getBlockDrop for new blocks 14-40', () => {
  for (const [id, name, , , , drop] of BIOME_BLOCK_TABLE) {
    test(`${name}(${id}) drops ${drop ? `${drop.count}x ${drop.item}` : 'null'}`, () => {
      if (drop === null) {
        expect(getBlockDrop(id)).toBeNull();
      } else {
        expect(getBlockDrop(id)).toEqual(drop);
      }
    });
  }
});

describe('biome expansion: coverage', () => {
  test('every new BLOCKS id 14-40 is covered in SPEED for at least one tool', () => {
    for (let id = 14; id <= 40; id++) {
      const maxSpeed = Math.max(
        getMiningSpeed('pickaxe', id),
        getMiningSpeed('hand', id),
        getMiningSpeed('sword', id)
      );
      expect(maxSpeed, `block id ${id} has no mining tool entry`).toBeGreaterThan(0);
    }
  });

  test('BAMBOO(27) breaks faster with hand than pickaxe', () => {
    // bamboo snaps easily — hand is fastest
    expect(getMiningSpeed('hand', 27)).toBeGreaterThan(getMiningSpeed('pickaxe', 27));
  });

  test('SCULK(39) and ECHO_BLOCK(40) drop nothing — deep dark is eerie', () => {
    expect(getBlockDrop(39)).toBeNull();
    expect(getBlockDrop(40)).toBeNull();
  });
});

// --- Mining update: ores + lava + obsidian (ids 41-46) -----------------------
describe('mining update: ore blocks 41-46', () => {
  const COAL_ORE = 41, IRON_ORE = 42, GOLD_ORE = 43, NETHERITE_ORE = 44,
        LAVA = 45, OBSIDIAN = 46;

  test('pickaxe mines ores, faster for softer ores', () => {
    expect(getMiningSpeed('pickaxe', COAL_ORE)).toBe(1.5);
    expect(getMiningSpeed('pickaxe', IRON_ORE)).toBe(1.2);
    expect(getMiningSpeed('pickaxe', GOLD_ORE)).toBe(1);
    expect(getMiningSpeed('pickaxe', NETHERITE_ORE)).toBe(0.8);
    expect(getMiningSpeed('pickaxe', OBSIDIAN)).toBe(0.4);
  });

  test('ores barely mine by hand', () => {
    expect(getMiningSpeed('hand', IRON_ORE)).toBeLessThan(getMiningSpeed('pickaxe', IRON_ORE));
    expect(getMiningSpeed('hand', OBSIDIAN)).toBeGreaterThan(0);
  });

  test('LAVA cannot be mined by any tool', () => {
    expect(getMiningSpeed('pickaxe', LAVA)).toBe(0);
    expect(getMiningSpeed('hand', LAVA)).toBe(0);
    expect(getMiningSpeed('sword', LAVA)).toBe(0);
    expect(applyMiningTick(0, LAVA, 'pickaxe')).toEqual({ progress: 0, completed: false });
  });

  test('ores drop their material; lava drops nothing', () => {
    expect(getBlockDrop(COAL_ORE)).toEqual({ item: 'coal', count: 1 });
    expect(getBlockDrop(IRON_ORE)).toEqual({ item: 'iron', count: 1 });
    expect(getBlockDrop(GOLD_ORE)).toEqual({ item: 'gold', count: 1 });
    expect(getBlockDrop(NETHERITE_ORE)).toEqual({ item: 'netherite', count: 1 });
    expect(getBlockDrop(OBSIDIAN)).toEqual({ item: 'obsidian', count: 1 });
    expect(getBlockDrop(LAVA)).toBeNull();
  });
});

describe('crafting update: placeable blocks 47-50', () => {
  const GLASS = 47, DOOR = 48, BED = 49, FURNACE = 50;

  test('craftable blocks are mineable', () => {
    for (const id of [GLASS, DOOR, BED, FURNACE]) {
      expect(getMiningSpeed('pickaxe', id)).toBeGreaterThan(0);
      expect(getMiningSpeed('hand', id)).toBeGreaterThan(0);
    }
  });

  test('craftable blocks return a base material (glass shatters to nothing)', () => {
    expect(getBlockDrop(GLASS)).toBeNull();
    expect(getBlockDrop(DOOR)).toEqual({ item: 'wood', count: 1 });
    expect(getBlockDrop(BED)).toEqual({ item: 'wood', count: 1 });
    expect(getBlockDrop(FURNACE)).toEqual({ item: 'stone', count: 1 });
  });
});

describe('nether update: blocks 51-54', () => {
  const PORTAL = 51, NETHERRACK = 52, GLOWSTONE = 53, SOUL_SAND = 54;

  test('PORTAL cannot be mined', () => {
    expect(getMiningSpeed('pickaxe', PORTAL)).toBe(0);
    expect(getMiningSpeed('hand', PORTAL)).toBe(0);
    expect(getBlockDrop(PORTAL)).toBeNull();
  });

  test('nether ground blocks are mineable', () => {
    for (const id of [NETHERRACK, GLOWSTONE, SOUL_SAND]) {
      expect(getMiningSpeed('pickaxe', id)).toBeGreaterThan(0);
    }
  });

  test('nether ground blocks drop expected materials', () => {
    expect(getBlockDrop(NETHERRACK)).toEqual({ item: 'stone', count: 1 });
    expect(getBlockDrop(SOUL_SAND)).toEqual({ item: 'stone', count: 1 });
    expect(getBlockDrop(GLOWSTONE)).toBeNull();
  });
});

describe('addToInventory', () => {
  test('adding stone increments slot 0 and does not mutate original', () => {
    const inv = makeInventory();
    const next = addToInventory(inv, 'stone', 3);
    expect(next.items[0].count).toBe(3);
    expect(inv.items[0].count).toBe(0); // original unmutated
    expect(next).not.toBe(inv);
  });
  test('adding wood increments slot 1', () => {
    const inv = makeInventory();
    const next = addToInventory(inv, 'wood', 2);
    expect(next.items[1].count).toBe(2);
    expect(inv.items[1].count).toBe(0);
  });
  test('adding food increments slot 4', () => {
    const inv = makeInventory();
    const next = addToInventory(inv, 'food', 5);
    expect(next.items[4].count).toBe(5);
    expect(inv.items[4].count).toBe(0);
  });
  test('pickaxe/sword/diamond drops are ignored (not in slot map)', () => {
    const inv = makeInventory();
    const a = addToInventory(inv, 'pickaxe', 1);
    const b = addToInventory(inv, 'sword', 1);
    const c = addToInventory(inv, 'diamond', 1);
    expect(a.items[2].count).toBe(1); // unchanged
    expect(b.items[3].count).toBe(1); // unchanged
    expect(c.items).toEqual(inv.items);
  });
  test('preserves selected and other slot data', () => {
    const inv = makeInventory();
    inv.selected = 2;
    const next = addToInventory(inv, 'stone', 1);
    expect(next.selected).toBe(2);
    expect(next.items[2]).toEqual({ type: 'pickaxe', count: 1 });
    expect(next.items[3]).toEqual({ type: 'sword', count: 1 });
  });
});
