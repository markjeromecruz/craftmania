import { test, expect } from 'vitest';
import { computeCollisionSnap } from '../src/physics.js';

// Bug 5: visual feet gap. Snap formula must use footOffset (pixels from the
// entity's draw origin to its visual bottom), not a fixed `height`.
// BLOCK_SIZE = 32. Player footOffset=4, Pet=12, Mob=0.

test('player (footOffset=4) snaps feet to top of solid block below', () => {
  const result = computeCollisionSnap(300, 8, 4, 10, true);
  expect(result).toEqual({ y: 316, vy: 0, onGround: true });
});

test('pet (footOffset=12) snaps feet to top of solid block below', () => {
  const result = computeCollisionSnap(288, 5, 12, 10, true);
  expect(result).toEqual({ y: 308, vy: 0, onGround: true });
});

test('mob (footOffset=0) snaps feet to top of solid block below', () => {
  const result = computeCollisionSnap(320, 4, 0, 11, true);
  expect(result).toEqual({ y: 352, vy: 0, onGround: true });
});

test('no snap when block below is air; y and vy pass through unchanged', () => {
  const result = computeCollisionSnap(200, 5, 4, 10, false);
  expect(result).toEqual({ y: 200, vy: 5, onGround: false });
});

test('idempotent: snapping an already-snapped value is a fixed point', () => {
  const first = computeCollisionSnap(300, 8, 4, 10, true);
  const second = computeCollisionSnap(first.y, first.vy, 4, 10, true);
  expect(second).toEqual(first);
});

test('boundary: footOffset=0 lands exactly on the grid line (no off-by-one)', () => {
  const result = computeCollisionSnap(100, 3, 0, 7, true);
  expect(result.y).toBe(7 * 32);
  expect(result.y % 32).toBe(0);
  expect(result.vy).toBe(0);
  expect(result.onGround).toBe(true);
});
