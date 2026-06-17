// Pure per-block visual flourishes drawn AFTER the base fill+stroke in
// inline drawBlock. Plain blocks are no-ops; only blocks with a visual
// identity draw here.
//
// Signature: drawBlockDetail(ctx, x, y, block, BLOCK_SIZE) -> void

import { BLOCKS } from './render-data.js';

export function drawBlockDetail(ctx, x, y, block, BLOCK_SIZE) {
  switch (block) {
    case BLOCKS.GRASS:
      ctx.fillStyle = '#654321';
      ctx.fillRect(x, y + BLOCK_SIZE - 8, BLOCK_SIZE, 8);
      break;
    case BLOCKS.DIAMOND:
      ctx.fillStyle = '#FFF';
      ctx.fillRect(x + 10, y + 10, 4, 4);
      break;
    case BLOCKS.SNOW:
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, BLOCK_SIZE, 4);
      break;
    case BLOCKS.CACTUS:
      ctx.fillStyle = '#1E5631';
      ctx.fillRect(x + 14, y + 4, 4, BLOCK_SIZE - 8);
      break;
    case BLOCKS.ICE:
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 6, y + 6, 2, 2);
      ctx.fillRect(x + 18, y + 20, 2, 2);
      break;

    // --- New biome details (Phase 2A additions) ---

    case BLOCKS.TALL_GRASS:
      ctx.fillStyle = '#3E8E26';
      ctx.fillRect(x + 8, y + 24, 2, 8);
      ctx.fillRect(x + 15, y + 22, 2, 10);
      ctx.fillRect(x + 22, y + 25, 2, 7);
      break;

    case BLOCKS.FLOWER_RED:
      ctx.fillStyle = '#3E8E26';
      ctx.fillRect(x + 15, y + 20, 2, 8);
      ctx.fillStyle = '#C9303A';
      ctx.fillRect(x + 14, y + 18, 3, 3);
      break;

    case BLOCKS.FLOWER_YELLOW:
      ctx.fillStyle = '#3E8E26';
      ctx.fillRect(x + 15, y + 20, 2, 8);
      ctx.fillStyle = '#F2C744';
      ctx.fillRect(x + 14, y + 18, 3, 3);
      break;

    case BLOCKS.FLOWER_PINK:
      ctx.fillStyle = '#3E8E26';
      ctx.fillRect(x + 15, y + 20, 2, 8);
      ctx.fillStyle = '#F49AC2';
      ctx.fillRect(x + 14, y + 18, 3, 3);
      break;

    case BLOCKS.DARK_OAK_LEAVES:
      ctx.fillStyle = '#0F2E10';
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillRect(x + 26, y + 4, 2, 2);
      ctx.fillRect(x + 4, y + 26, 2, 2);
      ctx.fillRect(x + 26, y + 26, 2, 2);
      break;

    case BLOCKS.MUSHROOM:
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 14, y + 16, 4, 12);
      ctx.fillRect(x + 8, y + 6, 2, 2);
      ctx.fillRect(x + 16, y + 4, 2, 2);
      ctx.fillRect(x + 22, y + 8, 2, 2);
      break;

    case BLOCKS.PODZOL:
      ctx.fillStyle = '#222222';
      ctx.fillRect(x + 6, y + 2, 2, 2);
      ctx.fillRect(x + 16, y + 4, 2, 2);
      ctx.fillRect(x + 24, y + 2, 2, 2);
      break;

    case BLOCKS.MOSS_BLOCK:
      ctx.fillStyle = '#3E5C1F';
      ctx.fillRect(x + 6, y + 6, 2, 2);
      ctx.fillRect(x + 22, y + 10, 2, 2);
      ctx.fillRect(x + 10, y + 22, 2, 2);
      ctx.fillRect(x + 24, y + 24, 2, 2);
      break;

    case BLOCKS.JUNGLE_LEAVES:
      ctx.fillStyle = '#5DD86F';
      ctx.fillRect(x + 6, y + 8, 2, 2);
      ctx.fillRect(x + 18, y + 14, 2, 2);
      ctx.fillRect(x + 22, y + 22, 2, 2);
      break;

    case BLOCKS.VINE:
      ctx.fillStyle = '#2E5C1F';
      ctx.fillRect(x + 15, y, 2, BLOCK_SIZE);
      break;

    case BLOCKS.BAMBOO:
      ctx.fillStyle = '#7FA84A';
      ctx.fillRect(x + 14, y, 4, BLOCK_SIZE);
      ctx.fillStyle = '#5C7A2E';
      ctx.fillRect(x + 14, y + 10, 4, 2);
      ctx.fillRect(x + 14, y + 22, 4, 2);
      break;

    case BLOCKS.CHERRY_LEAVES:
      ctx.fillStyle = '#FFC8DC';
      ctx.fillRect(x + 4, y + 6, 2, 2);
      ctx.fillRect(x + 14, y + 4, 2, 2);
      ctx.fillRect(x + 24, y + 10, 2, 2);
      ctx.fillRect(x + 8, y + 20, 2, 2);
      ctx.fillRect(x + 22, y + 24, 2, 2);
      break;

    case BLOCKS.PALE_LEAVES:
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 6, y + 8, 2, 2);
      ctx.fillRect(x + 18, y + 14, 2, 2);
      ctx.fillRect(x + 22, y + 22, 2, 2);
      break;

    case BLOCKS.HANGING_MOSS:
      ctx.fillStyle = '#7B8A6E';
      ctx.fillRect(x + 4, y, 2, 10);
      ctx.fillRect(x + 12, y, 2, 6);
      ctx.fillRect(x + 20, y, 2, 12);
      ctx.fillRect(x + 26, y, 2, 8);
      break;

    case BLOCKS.GRAVEL:
      ctx.fillStyle = '#555555';
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillRect(x + 22, y + 4, 2, 2);
      ctx.fillRect(x + 4, y + 22, 2, 2);
      ctx.fillRect(x + 22, y + 22, 2, 2);
      break;

    case BLOCKS.AZALEA_LEAVES:
      ctx.fillStyle = '#F49AC2';
      ctx.fillRect(x + 6, y + 8, 2, 2);
      ctx.fillRect(x + 18, y + 6, 2, 2);
      ctx.fillRect(x + 22, y + 18, 2, 2);
      ctx.fillRect(x + 10, y + 22, 2, 2);
      break;

    case BLOCKS.GLOW_BERRIES:
      ctx.fillStyle = '#F2C744';
      ctx.fillRect(x + 6, y + 22, 3, 3);
      ctx.fillRect(x + 14, y + 18, 3, 3);
      ctx.fillRect(x + 22, y + 24, 3, 3);
      break;

    case BLOCKS.CLAY:
      ctx.fillStyle = '#C0C2CC';
      ctx.fillRect(x + 12, y + 14, 8, 4);
      break;

    case BLOCKS.DRIPSTONE:
      ctx.fillStyle = '#6C5942';
      ctx.fillRect(x + 10, y, 2, 12);
      ctx.fillRect(x + 15, y, 2, 18);
      ctx.fillRect(x + 20, y, 2, 12);
      break;

    case BLOCKS.POINTED_DRIPSTONE:
      ctx.fillStyle = '#6C5942';
      ctx.fillRect(x + 14, y, 4, 28);
      break;

    case BLOCKS.SCULK:
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, BLOCK_SIZE, 2);
      ctx.fillRect(x, y + BLOCK_SIZE - 2, BLOCK_SIZE, 2);
      ctx.fillRect(x, y, 2, BLOCK_SIZE);
      ctx.fillRect(x + BLOCK_SIZE - 2, y, 2, BLOCK_SIZE);
      ctx.fillStyle = '#0AC4D4';
      ctx.fillRect(x + 14, y + 14, 4, 4);
      break;

    case BLOCKS.ECHO_BLOCK:
      ctx.fillStyle = '#0AC4D4';
      ctx.fillRect(x + 15, y + 15, 2, 2);
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillRect(x + 26, y + 4, 2, 2);
      ctx.fillRect(x + 4, y + 26, 2, 2);
      ctx.fillRect(x + 26, y + 26, 2, 2);
      break;

    // --- Ores + deep blocks (mining update) ---

    case BLOCKS.COAL_ORE:
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(x + 7, y + 8, 5, 5);
      ctx.fillRect(x + 18, y + 6, 4, 4);
      ctx.fillRect(x + 12, y + 19, 6, 5);
      ctx.fillRect(x + 21, y + 20, 4, 4);
      break;

    case BLOCKS.IRON_ORE:
      ctx.fillStyle = '#D9A066';
      ctx.fillRect(x + 8, y + 9, 5, 4);
      ctx.fillRect(x + 19, y + 8, 4, 4);
      ctx.fillRect(x + 13, y + 20, 5, 4);
      break;

    case BLOCKS.GOLD_ORE:
      ctx.fillStyle = '#FFD84D';
      ctx.fillRect(x + 8, y + 8, 5, 5);
      ctx.fillRect(x + 19, y + 10, 4, 4);
      ctx.fillRect(x + 12, y + 20, 5, 4);
      break;

    case BLOCKS.NETHERITE_ORE:
      ctx.fillStyle = '#6B5B66';
      ctx.fillRect(x + 8, y + 9, 5, 4);
      ctx.fillRect(x + 18, y + 8, 5, 4);
      ctx.fillStyle = '#C9B7C2';
      ctx.fillRect(x + 13, y + 20, 5, 4);
      break;

    case BLOCKS.LAVA:
      // Shimmering brighter blobs over the orange base.
      ctx.fillStyle = '#FFD23A';
      ctx.fillRect(x + 5, y + 7, 7, 5);
      ctx.fillRect(x + 19, y + 14, 6, 5);
      ctx.fillStyle = '#FF8A3A';
      ctx.fillRect(x + 12, y + 20, 8, 5);
      break;

    case BLOCKS.OBSIDIAN:
      ctx.fillStyle = '#3A2A5A';
      ctx.fillRect(x + 6, y + 6, 3, 3);
      ctx.fillRect(x + 20, y + 12, 3, 3);
      ctx.fillRect(x + 12, y + 22, 3, 3);
      break;

    // --- Craftable blocks ---

    case BLOCKS.GLASS:
      // Window frame + a light shine.
      ctx.fillStyle = '#E1F5FE';
      ctx.fillRect(x + 2, y + 2, BLOCK_SIZE - 4, 2);
      ctx.fillRect(x + 2, y + 2, 2, BLOCK_SIZE - 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 7, y + 7, 4, 8);
      break;

    case BLOCKS.DOOR:
      // Two panels + a knob.
      ctx.fillStyle = '#5E3A1A';
      ctx.fillRect(x + 6, y + 4, BLOCK_SIZE - 12, 10);
      ctx.fillRect(x + 6, y + 18, BLOCK_SIZE - 12, 10);
      ctx.fillStyle = '#FFD24A';
      ctx.fillRect(x + BLOCK_SIZE - 9, y + 14, 3, 3);
      break;

    case BLOCKS.BED:
      // Pillow + blanket.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 3, y + 8, 8, BLOCK_SIZE - 12);
      ctx.fillStyle = '#B71C1C';
      ctx.fillRect(x + 13, y + 10, BLOCK_SIZE - 16, BLOCK_SIZE - 16);
      ctx.fillStyle = '#5E3A1A';
      ctx.fillRect(x + 2, y + BLOCK_SIZE - 5, BLOCK_SIZE - 4, 4);
      break;

    case BLOCKS.FURNACE:
      // Stone box with a glowing opening.
      ctx.fillStyle = '#3A3A3A';
      ctx.fillRect(x + 8, y + 14, BLOCK_SIZE - 16, 12);
      ctx.fillStyle = '#FF8A3A';
      ctx.fillRect(x + 12, y + 18, BLOCK_SIZE - 24, 6);
      break;

    // --- Nether blocks ---

    case BLOCKS.PORTAL:
      // Swirly lighter-purple sparkles over the purple base.
      ctx.fillStyle = '#C77DFF';
      ctx.fillRect(x + 6, y + 6, 4, 4);
      ctx.fillRect(x + 20, y + 14, 4, 4);
      ctx.fillRect(x + 12, y + 22, 4, 4);
      ctx.fillStyle = '#E0AAFF';
      ctx.fillRect(x + 15, y + 10, 2, 2);
      break;

    case BLOCKS.NETHERRACK:
      ctx.fillStyle = '#561F1F';
      ctx.fillRect(x + 5, y + 6, 3, 3);
      ctx.fillRect(x + 18, y + 9, 3, 3);
      ctx.fillRect(x + 10, y + 20, 3, 3);
      ctx.fillRect(x + 23, y + 22, 3, 3);
      break;

    case BLOCKS.GLOWSTONE:
      ctx.fillStyle = '#FFF3C4';
      ctx.fillRect(x + 6, y + 6, 5, 5);
      ctx.fillRect(x + 18, y + 8, 5, 5);
      ctx.fillRect(x + 10, y + 19, 5, 5);
      ctx.fillRect(x + 20, y + 20, 4, 4);
      break;

    case BLOCKS.SOUL_SAND:
      ctx.fillStyle = '#2E241A';
      ctx.fillRect(x + 7, y + 10, 5, 5);   // little hollow "faces"
      ctx.fillRect(x + 19, y + 16, 5, 5);
      break;

    default:
      // No-op for plain blocks (STONE, WOOD, AIR, BEDROCK, DIRT, LEAVES,
      // SAND, WATER, PINE_LEAVES, DARK_OAK_WOOD, SPRUCE_WOOD, JUNGLE_WOOD,
      // CHERRY_WOOD, PALE_OAK_WOOD — base color is sufficient).
      return;
  }
}
