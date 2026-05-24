import { test, expect } from 'vitest';
import {
  tryEat,
  applyHungerTick,
  MAX_HUNGER,
  FOOD_HUNGER_RESTORE,
  HUNGER_DRAIN_PER_TICK,
} from '../src/survival.js';

test('tryEat: justPressed=false is a no-op', () => {
  const result = tryEat(5, 10, false);
  expect(result.foodCount).toBe(5);
  expect(result.hunger).toBeCloseTo(10, 5);
  expect(result.ate).toBe(false);
});

test('tryEat: justPressed=true but no food is a no-op', () => {
  const result = tryEat(0, 10, true);
  expect(result.foodCount).toBe(0);
  expect(result.hunger).toBeCloseTo(10, 5);
  expect(result.ate).toBe(false);
});

test('tryEat: hunger already at max → no-op', () => {
  const result = tryEat(5, MAX_HUNGER, true);
  expect(result.foodCount).toBe(5);
  expect(result.hunger).toBeCloseTo(MAX_HUNGER, 5);
  expect(result.ate).toBe(false);
});

test('tryEat: normal eat consumes one food and restores hunger', () => {
  const result = tryEat(5, 10, true);
  expect(result.foodCount).toBe(4);
  expect(result.hunger).toBeCloseTo(10 + FOOD_HUNGER_RESTORE, 5);
  expect(result.ate).toBe(true);
});

test('tryEat: hunger restore is capped at MAX_HUNGER', () => {
  const result = tryEat(5, 15, true);
  expect(result.foodCount).toBe(4);
  expect(result.hunger).toBeCloseTo(MAX_HUNGER, 5);
  expect(result.ate).toBe(true);
});

test('tryEat: edge-trigger across 30 frames consumes exactly one food', () => {
  let foodCount = 5;
  let hunger = 10;
  // First frame: edge (E was just pressed).
  let r = tryEat(foodCount, hunger, true);
  foodCount = r.foodCount;
  hunger = r.hunger;
  // Subsequent 29 frames: key still held but not justPressed.
  for (let i = 0; i < 29; i++) {
    r = tryEat(foodCount, hunger, false);
    foodCount = r.foodCount;
    hunger = r.hunger;
  }
  expect(foodCount).toBe(4);
  expect(hunger).toBeCloseTo(18, 5);
});

test('tryEat: does not mutate caller args (pure)', () => {
  // Pass primitives; just confirm repeated calls with same args are stable.
  const a = tryEat(5, 10, true);
  const b = tryEat(5, 10, true);
  expect(a).toEqual(b);
});

test('applyHungerTick: full hunger drains by drain*delta, health unchanged', () => {
  const r = applyHungerTick(20, 20, 10);
  expect(r.hunger).toBeCloseTo(20 - HUNGER_DRAIN_PER_TICK * 10, 5);
  expect(r.health).toBeCloseTo(20, 5);
});

test('applyHungerTick: zero hunger drains health', () => {
  const r = applyHungerTick(0, 20, 10);
  expect(r.hunger).toBeCloseTo(0, 5);
  expect(r.health).toBeCloseTo(20 - 0.01 * 10, 5);
});

test('applyHungerTick: hunger clamps to 0 this tick, health untouched until next tick', () => {
  const r = applyHungerTick(0.001, 20, 10);
  expect(r.hunger).toBeCloseTo(0, 5);
  expect(r.health).toBeCloseTo(20, 5);
});

test('applyHungerTick: full hunger with low health → health stays', () => {
  const r = applyHungerTick(20, 0.001, 1);
  expect(r.hunger).toBeCloseTo(20 - HUNGER_DRAIN_PER_TICK, 5);
  expect(r.health).toBeCloseTo(0.001, 5);
});
