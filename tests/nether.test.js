import { describe, test, expect } from 'vitest';
import { BLOCKS } from '../src/render-data.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../src/world.js';
import { generateNether } from '../src/nether.js';

describe('generateNether', () => {
  test('returns a 2D array WORLD_WIDTH x WORLD_HEIGHT', () => {
    const w = generateNether(42);
    expect(w.length).toBe(WORLD_WIDTH);
    for (let x = 0; x < WORLD_WIDTH; x++) expect(w[x].length).toBe(WORLD_HEIGHT);
  });

  test('is deterministic for the same seed', () => {
    expect(JSON.stringify(generateNether(42))).toBe(JSON.stringify(generateNether(42)));
  });

  test('different seeds produce different nethers', () => {
    expect(JSON.stringify(generateNether(42))).not.toBe(JSON.stringify(generateNether(7)));
  });

  test('bottom row is bedrock', () => {
    const w = generateNether(42);
    for (let x = 0; x < WORLD_WIDTH; x++) {
      expect(w[x][WORLD_HEIGHT - 1]).toBe(BLOCKS.BEDROCK);
    }
  });

  test('contains netherrack, lava, glowstone and netherite ore', () => {
    const w = generateNether(42);
    const present = new Set();
    for (let x = 0; x < WORLD_WIDTH; x++)
      for (let y = 0; y < WORLD_HEIGHT; y++) present.add(w[x][y]);
    expect(present.has(BLOCKS.NETHERRACK)).toBe(true);
    expect(present.has(BLOCKS.LAVA)).toBe(true);
    expect(present.has(BLOCKS.GLOWSTONE)).toBe(true);
    expect(present.has(BLOCKS.NETHERITE_ORE)).toBe(true);
  });

  test('has no overworld grass or dirt', () => {
    const w = generateNether(42);
    for (let x = 0; x < WORLD_WIDTH; x++)
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        expect(w[x][y]).not.toBe(BLOCKS.GRASS);
        expect(w[x][y]).not.toBe(BLOCKS.DIRT);
      }
  });
});
