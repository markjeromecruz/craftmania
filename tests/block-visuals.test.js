import { describe, test, expect } from 'vitest';
import { BLOCKS } from '../src/render-data.js';
import { drawBlockDetail } from '../src/block-visuals.js';

function mockCtx() {
  const calls = [];
  return {
    set fillStyle(v) {
      calls.push(['fillStyle', v]);
    },
    fillRect: (...a) => calls.push(['fillRect', ...a]),
    _calls: calls,
  };
}

function countFillRects(ctx) {
  return ctx._calls.filter(c => c[0] === 'fillRect').length;
}

describe('drawBlockDetail', () => {
  test('every BLOCKS id renders without throwing', () => {
    const ctx = mockCtx();
    for (const id of Object.values(BLOCKS)) {
      expect(() => drawBlockDetail(ctx, 0, 0, id, 32)).not.toThrow();
    }
  });

  test('plain block (STONE) is a no-op', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.STONE, 32);
    expect(ctx._calls).toHaveLength(0);
  });

  test('AIR is a no-op', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.AIR, 32);
    expect(ctx._calls).toHaveLength(0);
  });

  test('plain wood variants (DARK_OAK_WOOD, SPRUCE_WOOD, JUNGLE_WOOD, CHERRY_WOOD, PALE_OAK_WOOD) are no-ops', () => {
    for (const id of [
      BLOCKS.DARK_OAK_WOOD,
      BLOCKS.SPRUCE_WOOD,
      BLOCKS.JUNGLE_WOOD,
      BLOCKS.CHERRY_WOOD,
      BLOCKS.PALE_OAK_WOOD,
    ]) {
      const ctx = mockCtx();
      drawBlockDetail(ctx, 0, 0, id, 32);
      expect(ctx._calls, `block id ${id} should be a no-op`).toHaveLength(0);
    }
  });

  test('GRASS draws a dirt strip at bottom', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.GRASS, 32);
    expect(ctx._calls).toContainEqual(['fillStyle', '#654321']);
    expect(ctx._calls).toContainEqual(['fillRect', 0, 24, 32, 8]);
  });

  test('DIAMOND draws a white sparkle', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.DIAMOND, 32);
    expect(ctx._calls).toContainEqual(['fillRect', 10, 10, 4, 4]);
  });

  test('SNOW draws a top band', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.SNOW, 32);
    expect(ctx._calls).toContainEqual(['fillRect', 0, 0, 32, 4]);
  });

  test('CACTUS draws a vertical center stripe', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.CACTUS, 32);
    expect(ctx._calls).toContainEqual(['fillRect', 14, 4, 4, 24]);
  });

  test('TALL_GRASS draws 3 vertical stalks', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.TALL_GRASS, 32);
    expect(countFillRects(ctx)).toBe(3);
  });

  test('FLOWER_RED draws a stem and a red petal', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.FLOWER_RED, 32);
    expect(ctx._calls).toContainEqual(['fillStyle', '#C9303A']);
    // stem + petal
    expect(countFillRects(ctx)).toBe(2);
  });

  test('CHERRY_LEAVES draws at least 5 blossoms', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.CHERRY_LEAVES, 32);
    expect(countFillRects(ctx)).toBeGreaterThanOrEqual(5);
  });

  test('BAMBOO draws a vertical 4-wide column spanning the block', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.BAMBOO, 32);
    // First fillRect is the full-height column
    expect(ctx._calls).toContainEqual(['fillRect', 14, 0, 4, 32]);
  });

  test('GRAVEL draws 4 corner pebbles', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.GRAVEL, 32);
    expect(countFillRects(ctx)).toBe(4);
    expect(ctx._calls).toContainEqual(['fillRect', 4, 4, 2, 2]);
    expect(ctx._calls).toContainEqual(['fillRect', 22, 4, 2, 2]);
    expect(ctx._calls).toContainEqual(['fillRect', 4, 22, 2, 2]);
    expect(ctx._calls).toContainEqual(['fillRect', 22, 22, 2, 2]);
  });

  test('VINE draws a vertical line spanning the block', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.VINE, 32);
    expect(ctx._calls).toContainEqual(['fillRect', 15, 0, 2, 32]);
  });

  test('SCULK draws a border plus a cyan center', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 0, 0, BLOCKS.SCULK, 32);
    expect(ctx._calls).toContainEqual(['fillStyle', '#0AC4D4']);
    expect(ctx._calls).toContainEqual(['fillRect', 14, 14, 4, 4]);
  });

  test('respects x/y offsets (TALL_GRASS at x=100, y=200)', () => {
    const ctx = mockCtx();
    drawBlockDetail(ctx, 100, 200, BLOCKS.TALL_GRASS, 32);
    // Bottom-most stalk should be at y=200+24..32 territory
    expect(ctx._calls).toContainEqual(['fillRect', 108, 224, 2, 8]);
  });
});
