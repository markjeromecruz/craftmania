// Pure collision-snap helper. Fixes Bug 5 (visual feet-gap) by snapping the
// entity's *visual bottom* to the top of the block below — using footOffset
// (pixels from draw origin to feet) rather than a fixed height constant.
//
// Caller is responsible for computing gridYBelow (`Math.floor((y + footOffset)
// / BLOCK_SIZE)`) and blockSolidBelow from the world grid. Keeping those out
// of this function makes it a pure, trivially-testable math step.

import { BLOCK_SIZE } from './render-data.js';

export function computeCollisionSnap(y, vy, footOffset, gridYBelow, blockSolidBelow) {
  if (blockSolidBelow !== true) {
    return { y, vy, onGround: false };
  }
  return {
    y: gridYBelow * BLOCK_SIZE - footOffset,
    vy: 0,
    onGround: true,
  };
}
