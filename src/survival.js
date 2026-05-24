// Pure survival mechanics: edge-triggered eating + per-tick hunger/health math.
// Extracted so the game loop can call these without mutating shared state and
// without the every-frame "hold E to eat 6 items" bug.

export const HUNGER_DRAIN_PER_TICK = 0.002;
export const HEALTH_DRAIN_PER_TICK_WHEN_STARVING = 0.01;
export const FOOD_HUNGER_RESTORE = 8;
export const MAX_HUNGER = 20;
export const MAX_HEALTH = 20;

export function applyHungerTick(hunger, health, deltaTicks) {
  const nextHunger = Math.max(0, hunger - HUNGER_DRAIN_PER_TICK * deltaTicks);
  let nextHealth = health;
  if (hunger <= 0) {
    nextHealth = Math.max(0, health - HEALTH_DRAIN_PER_TICK_WHEN_STARVING * deltaTicks);
  }
  return { hunger: nextHunger, health: nextHealth };
}

export function tryEat(foodCount, hunger, justPressed) {
  if (!justPressed || foodCount <= 0 || hunger >= MAX_HUNGER) {
    return { foodCount, hunger, ate: false };
  }
  return {
    foodCount: foodCount - 1,
    hunger: Math.min(MAX_HUNGER, hunger + FOOD_HUNGER_RESTORE),
    ate: true,
  };
}
