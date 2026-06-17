// Nether dimension generator. Pure: same seed -> same world. Returns a 2D
// world[x][y] array the same shape as the overworld (so the inline engine's
// camera / collision / spawn code works unchanged), themed with netherrack,
// lava lakes, glowstone, soul sand, and plenty of netherite ore.

import { BLOCKS } from './render-data.js';
import { WORLD_WIDTH, WORLD_HEIGHT, makeRng } from './world.js';

export function generateNether(seed) {
  // Distinct seed offset ("NETH") so the nether never mirrors the overworld.
  const rng = makeRng(((seed >>> 0) ^ 0x4E455448) >>> 0);
  const world = [];
  for (let x = 0; x < WORLD_WIDTH; x++) {
    world[x] = new Array(WORLD_HEIGHT);
    for (let y = 0; y < WORLD_HEIGHT; y++) world[x][y] = BLOCKS.AIR;
  }

  for (let x = 0; x < WORLD_WIDTH; x++) {
    const base = WORLD_HEIGHT / 2 + Math.sin(x * 0.12) * 4;
    let h = Math.floor(base + rng() * 3);
    if (h < 8) h = 8;
    if (h > WORLD_HEIGHT - 3) h = WORLD_HEIGHT - 3;

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      if (y === WORLD_HEIGHT - 1) {
        world[x][y] = BLOCKS.BEDROCK;
      } else if (y <= 1) {
        world[x][y] = BLOCKS.NETHERRACK;          // ceiling
      } else if (y < h) {
        world[x][y] = BLOCKS.AIR;                  // open cavern
      } else if (y === h) {
        world[x][y] = rng() < 0.15 ? BLOCKS.SOUL_SAND : BLOCKS.NETHERRACK;
      } else if (y > h + 3) {
        const r = rng();
        if (r < 0.10) world[x][y] = BLOCKS.NETHERITE_ORE;  // netherite is common here
        else if (r < 0.18) world[x][y] = BLOCKS.LAVA;       // lava pockets
        else if (r < 0.21) world[x][y] = BLOCKS.GLOWSTONE;
        else world[x][y] = BLOCKS.NETHERRACK;
      } else {
        world[x][y] = BLOCKS.NETHERRACK;
      }
    }
  }

  // Glowstone clusters dangling just under the ceiling.
  for (let x = 0; x < WORLD_WIDTH; x++) {
    if (rng() < 0.06) {
      const cy = 2 + Math.floor(rng() * 3);
      if (world[x][cy] === BLOCKS.AIR) world[x][cy] = BLOCKS.GLOWSTONE;
    }
  }

  return world;
}
