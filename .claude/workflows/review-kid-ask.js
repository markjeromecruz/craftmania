export const meta = {
  name: 'review-kid-ask',
  description: "Review a kid's Sandyten game request from physics, game-design & QA/usability lenses",
  whenToUse: "Before implementing any feature the kids ask for in Sandyten — fans out 3 expert reviewers and returns concise, actionable notes.",
  phases: [{ title: 'Review', detail: 'physics + game-design + QA/usability, in parallel' }],
};

// The kid's ask comes in via args (string, or {ask: "..."}).
const ask = (args && args.ask) || (typeof args === 'string' ? args : 'the requested change');

const GAME = `
Sandyten is a cute 3D browser game for kids (~5-10 yrs) built with three.js + anime.js,
no build step, served statically. It runs on desktop (WASD/arrows + mouse drag + scroll)
AND touch (joystick + tap). One big file: sandyten/src/main.js. Current world & systems:
- A town/courtyard with houses, THE STORE (buy items, sell crops/fish), a HOSPITAL,
  DRESSING ROOM, a driving ambulance, lamp posts, a campfire+campsite with tents.
- 2D billboard characters (always face the camera, Paper-Mario style) that roam between
  the city, park, neighborhood & campsite; kids/pets play on playground & pet-park activities.
- A bigger PARK with: playground (slide/swings/see-saw/merry-go-round/monkey bars/etc.),
  a fenced PET PARK (agility: hoops, tunnel, weave, A-frame, ball pit) for cats & dogs,
  a duck POND (fishing + ducks that swim), a forest with roaming animals.
- A GARDEN you plant/grow/harvest crops in. Day/night cycle (long day, softer light),
  weather (mostly sunny, occasional rain + splashable puddles), a pet dog (fetch a thrown
  ball with gravity), balloons, birds, moon/stars.
- Progression: collect coins (money), earn ✨ stars from QUESTS to level up (each level
  needs +5 more). Stars also bank to spend in a PRIZE shop (Speed Boots, Coin Magnet,
  Lucky Clover, Lantern, Power Crystal). Optional turn-based BATTLES vs cute monsters
  (slime/goblin/bat + a Big Boss Dragon) that make you stronger; leveling raises attack/HP.
- Mini-games in the Quests panel: Memory, Fruit Merge (2048-style), Block Blast! (8x8
  place-to-clear), Match Pairs, Snake. Save/Continue keeps level/coins/prizes; quests reset.
- Perf: adaptive quality (pixel ratio + bloom scale to FPS); pooled lamp lights; ?perf logs.
Constraints: keep it wholesome, non-violent (battles are gentle), readable to a young kid,
works on both desktop & touch, and cheap enough to hold 60fps on modest hardware.
`.trim();

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['go', 'tweak', 'concern'], description: 'go = build as-is; tweak = build with small adjustments; concern = needs rethink' },
    summary: { type: 'string', description: 'one-sentence take from this lens' },
    notes: { type: 'array', items: { type: 'string' }, description: 'the most important things to get right or watch out for (max 5)' },
    suggestions: { type: 'array', items: { type: 'string' }, description: 'concrete ways to make it better (max 3)' },
  },
  required: ['verdict', 'summary', 'notes', 'suggestions'],
};

const lenses = [
  {
    key: 'physics', label: 'physics',
    prompt: `You are a PHYSICS reviewer for the kids' game below.\n\n${GAME}\n\nThe child asked for: "${ask}"\n\nReview ONLY from a physics / believable-motion angle: gravity, collision & wall-blocking, momentum & bouncing, buoyancy/water, light & shadow, day/night, scale, and how anything moving should behave so it doesn't look broken. Point out what would look physically wrong if built naively, and give concrete kid-appropriate guidance to make it feel right. You may read sandyten/src/main.js and sandyten/README.md for how existing systems (ball fetch, wall collision, swimming, puddles) work. Keep every field short.`,
  },
  {
    key: 'design', label: 'game-design',
    prompt: `You are a VIDEO GAME DESIGNER reviewing the kids' game below.\n\n${GAME}\n\nThe child asked for: "${ask}"\n\nReview ONLY from a game-design angle: is it fun, does it fit the existing world, does it add a good reward/interaction loop, is it balanced (not grindy, not trivial, not unfair), and does it complement the current features (quests, prizes, battles, mini-games, park). Flag risks and give 1-3 concrete ways to make it more fun and cohesive for a young kid. Keep every field short.`,
  },
  {
    key: 'qa', label: 'qa-usability',
    prompt: `You are a QA & USABILITY reviewer for the kids' game below. Players are children ~5-10 on BOTH desktop (WASD/arrows, mouse) and touch (joystick, tap).\n\n${GAME}\n\nThe child asked for: "${ask}"\n\nReview ONLY from a QA/usability angle: discoverability (will a kid find it?), clarity (will they understand it without reading?), controls on desktop AND touch, accessibility/readability, edge cases, and likely BUGS to test (overlaps, getting stuck, save/load, perf). Give a concrete checklist of things to verify. Keep every field short.`,
  },
];

const reviews = await parallel(
  lenses.map((l) => () =>
    agent(l.prompt, { label: l.label, phase: 'Review', schema: SCHEMA })
      .then((r) => (r ? { lens: l.key, ...r } : { lens: l.key, verdict: 'concern', summary: 'reviewer unavailable', notes: [], suggestions: [] }))
  )
);

return { ask, reviews: reviews.filter(Boolean) };
