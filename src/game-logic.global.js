import * as CraftLogic from './game-logic.js';
window.CraftLogic = CraftLogic;
window.dispatchEvent(new Event('craftlogic:ready'));
