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
