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

  test('new biome blocks have expected colors', () => {
    expect(getBlockColor(BLOCKS.CACTUS)).toBe('#2E8B57');
    expect(getBlockColor(BLOCKS.SNOW)).toBe('#F0F8FF');
    expect(getBlockColor(BLOCKS.ICE)).toBe('#A5F2F3');
    expect(getBlockColor(BLOCKS.PINE_LEAVES)).toBe('#0B6623');
  });
});
