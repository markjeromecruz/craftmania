import { describe, test, expect } from 'vitest';
import { BLOCKS, BLOCK_SIZE, getBlockColor } from '../src/render-data.js';

describe('render-data BLOCKS constants', () => {
  test('preserves original block ids (AIR..BEDROCK unchanged)', () => {
    expect(BLOCKS.AIR).toBe(0);
    expect(BLOCKS.GRASS).toBe(1);
    expect(BLOCKS.DIRT).toBe(2);
    expect(BLOCKS.STONE).toBe(3);
    expect(BLOCKS.WOOD).toBe(4);
    expect(BLOCKS.LEAVES).toBe(5);
    expect(BLOCKS.DIAMOND).toBe(6);
    expect(BLOCKS.SAND).toBe(7);
    expect(BLOCKS.WATER).toBe(8);
    expect(BLOCKS.BEDROCK).toBe(9);
  });

  test('adds biome-specific blocks at 10..13', () => {
    expect(BLOCKS.CACTUS).toBe(10);
    expect(BLOCKS.SNOW).toBe(11);
    expect(BLOCKS.ICE).toBe(12);
    expect(BLOCKS.PINE_LEAVES).toBe(13);
  });

  test('pins Phase 2A biome expansion ids (14..40)', () => {
    expect(BLOCKS).toEqual(
      expect.objectContaining({
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
      }),
    );
  });

  test('pins mining-update ore ids (41..46)', () => {
    expect(BLOCKS).toEqual(
      expect.objectContaining({
        COAL_ORE: 41,
        IRON_ORE: 42,
        GOLD_ORE: 43,
        NETHERITE_ORE: 44,
        LAVA: 45,
        OBSIDIAN: 46,
      }),
    );
  });

  test('BLOCKS total count is 47 (AIR + 46 block types)', () => {
    expect(Object.keys(BLOCKS)).toHaveLength(47);
  });

  test('exports BLOCK_SIZE = 32', () => {
    expect(BLOCK_SIZE).toBe(32);
  });
});

describe('getBlockColor', () => {
  test('every BLOCKS value except AIR returns a non-null hex string', () => {
    for (const [name, id] of Object.entries(BLOCKS)) {
      if (name === 'AIR') continue;
      const color = getBlockColor(id);
      expect(color, `BLOCKS.${name} (${id}) should have a color`).not.toBeNull();
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test('AIR returns null (no color)', () => {
    expect(getBlockColor(BLOCKS.AIR)).toBeNull();
  });

  test('unknown block id returns null', () => {
    expect(getBlockColor(999)).toBeNull();
  });

  test('original biome blocks have expected colors', () => {
    expect(getBlockColor(BLOCKS.CACTUS)).toBe('#2E8B57');
    expect(getBlockColor(BLOCKS.SNOW)).toBe('#F0F8FF');
    expect(getBlockColor(BLOCKS.ICE)).toBe('#A5F2F3');
    expect(getBlockColor(BLOCKS.PINE_LEAVES)).toBe('#0B6623');
  });

  test('Phase 2A biome blocks have expected colors', () => {
    expect(getBlockColor(BLOCKS.TALL_GRASS)).toBe('#5BBF3A');
    expect(getBlockColor(BLOCKS.FLOWER_RED)).toBe('#C9303A');
    expect(getBlockColor(BLOCKS.FLOWER_YELLOW)).toBe('#F2C744');
    expect(getBlockColor(BLOCKS.FLOWER_PINK)).toBe('#F49AC2');
    expect(getBlockColor(BLOCKS.DARK_OAK_WOOD)).toBe('#3E2A14');
    expect(getBlockColor(BLOCKS.DARK_OAK_LEAVES)).toBe('#1F4D1B');
    expect(getBlockColor(BLOCKS.MUSHROOM)).toBe('#8B1A1A');
    expect(getBlockColor(BLOCKS.SPRUCE_WOOD)).toBe('#5A3A22');
    expect(getBlockColor(BLOCKS.PODZOL)).toBe('#4A2F1A');
    expect(getBlockColor(BLOCKS.MOSS_BLOCK)).toBe('#5C7A2E');
    expect(getBlockColor(BLOCKS.JUNGLE_WOOD)).toBe('#6E4B25');
    expect(getBlockColor(BLOCKS.JUNGLE_LEAVES)).toBe('#2FA84F');
    expect(getBlockColor(BLOCKS.VINE)).toBe('#4F8A3A');
    expect(getBlockColor(BLOCKS.BAMBOO)).toBe('#B9D27E');
    expect(getBlockColor(BLOCKS.CHERRY_WOOD)).toBe('#6E3F4F');
    expect(getBlockColor(BLOCKS.CHERRY_LEAVES)).toBe('#F2B6CE');
    expect(getBlockColor(BLOCKS.PALE_OAK_WOOD)).toBe('#B4B4A8');
    expect(getBlockColor(BLOCKS.PALE_LEAVES)).toBe('#C7C9B8');
    expect(getBlockColor(BLOCKS.HANGING_MOSS)).toBe('#9BAA8C');
    expect(getBlockColor(BLOCKS.GRAVEL)).toBe('#707070');
    expect(getBlockColor(BLOCKS.AZALEA_LEAVES)).toBe('#6FA248');
    expect(getBlockColor(BLOCKS.GLOW_BERRIES)).toBe('#F2A23A');
    expect(getBlockColor(BLOCKS.CLAY)).toBe('#A6A8B5');
    expect(getBlockColor(BLOCKS.DRIPSTONE)).toBe('#8E7A60');
    expect(getBlockColor(BLOCKS.POINTED_DRIPSTONE)).toBe('#B59F84');
    expect(getBlockColor(BLOCKS.SCULK)).toBe('#0E2A36');
    expect(getBlockColor(BLOCKS.ECHO_BLOCK)).toBe('#1E4858');
  });

  test('mining-update ore blocks have expected colors', () => {
    expect(getBlockColor(BLOCKS.COAL_ORE)).toBe('#5B5B5B');
    expect(getBlockColor(BLOCKS.IRON_ORE)).toBe('#B0A08C');
    expect(getBlockColor(BLOCKS.GOLD_ORE)).toBe('#8C7A40');
    expect(getBlockColor(BLOCKS.NETHERITE_ORE)).toBe('#3A2E33');
    expect(getBlockColor(BLOCKS.LAVA)).toBe('#FF5A1E');
    expect(getBlockColor(BLOCKS.OBSIDIAN)).toBe('#1A1026');
  });
});
