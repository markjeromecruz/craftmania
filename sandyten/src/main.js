// Sandyten — 3D world starter
// ---------------------------------------------------------------------------
// A polished, production-baseline three.js scene wired up with anime.js.
// Everything below is meant to be a clean canvas the kids can describe changes
// to: terrain, characters, mechanics, etc. The heavy lifting (renderer, sky,
// lighting, post-processing, controls) is already done and looks good.
//
// Libraries are loaded locally via the importmap in index.html — no CDN, no
// build step. To use ANY three.js addon, just:  import { X } from 'three/addons/...';
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { animate, createTimeline, stagger, utils } from 'animejs';

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
app.appendChild(renderer.domElement);

// ---------------------------------------------------------------------------
// Scene + camera
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbfd8ef, 0.012);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(14, 9, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 2, 0);
controls.maxPolarAngle = Math.PI * 0.495; // don't go under the ground
controls.minDistance = 6;
controls.maxDistance = 60;

// ---------------------------------------------------------------------------
// Sky + sun
// ---------------------------------------------------------------------------
const sky = new Sky();
sky.scale.setScalar(4500);
scene.add(sky);

const sun = new THREE.Vector3();
const skyU = sky.material.uniforms;
skyU.turbidity.value = 8;
skyU.rayleigh.value = 2;
skyU.mieCoefficient.value = 0.005;
skyU.mieDirectionalG.value = 0.8;

function setSun(elevationDeg, azimuthDeg) {
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = THREE.MathUtils.degToRad(azimuthDeg);
  sun.setFromSphericalCoords(1, phi, theta);
  skyU.sunPosition.value.copy(sun);
  sunLight.position.copy(sun).multiplyScalar(60);
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3b5a3a, 0.55);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight(0xfff2d6, 2.4);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 200;
sunLight.shadow.camera.left = -40;
sunLight.shadow.camera.right = 40;
sunLight.shadow.camera.top = 40;
sunLight.shadow.camera.bottom = -40;
sunLight.shadow.bias = -0.0002;
scene.add(sunLight);
scene.add(sunLight.target);

setSun(18, 135);

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(120, 64),
  new THREE.MeshStandardMaterial({ color: 0x5a8f4e, roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// A soft grid so the space reads as a buildable world, not a void.
const grid = new THREE.GridHelper(120, 60, 0xffffff, 0xffffff);
grid.material.transparent = true;
grid.material.opacity = 0.06;
grid.position.y = 0.01;
scene.add(grid);

// ---------------------------------------------------------------------------
// Demo objects — floating crystals (placeholder content, fun to look at)
// These prove lighting + bloom + anime.js entrance animations all work.
// ---------------------------------------------------------------------------
const crystals = new THREE.Group();
scene.add(crystals);

const crystalColors = [0x7fd1ff, 0xffd166, 0xff7eb6, 0x9b8cff, 0x6ee7b7];
for (let i = 0; i < 5; i++) {
  const mat = new THREE.MeshStandardMaterial({
    color: crystalColors[i],
    emissive: crystalColors[i],
    emissiveIntensity: 0.35,
    roughness: 0.15,
    metalness: 0.1,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat);
  const angle = (i / 5) * Math.PI * 2;
  // float high above the fountain as ambient sparkle (characters stand below)
  mesh.position.set(Math.cos(angle) * 3.2, 6, Math.sin(angle) * 3.2);
  mesh.castShadow = true;
  mesh.userData.baseY = mesh.position.y;
  mesh.userData.spin = 0.3 + Math.random() * 0.5;
  mesh.scale.setScalar(0); // start hidden; anime.js pops them in
  crystals.add(mesh);
}

// ---------------------------------------------------------------------------
// Loaded 3D assets — real CC0 models (Kenney Fantasy Town Kit).
// This is the asset pipeline: drop a .glb in assets/models/ and load it here.
// A cute fairy-tale courtyard: a fountain in the middle, trees around it.
// ---------------------------------------------------------------------------
const gltfLoader = new GLTFLoader();

// helper: load a model, enable shadows, place + scale it, add to the scene.
function loadModel(file, { position = [0, 0, 0], rotationY = 0, scale = 1 } = {}) {
  gltfLoader.load(`./assets/models/${file}`, (gltf) => {
    const model = gltf.scene;
    model.position.set(...position);
    model.rotation.y = rotationY;
    model.scale.setScalar(scale);
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    scene.add(model);
    // gentle "place down" pop using anime.js
    model.scale.setScalar(scale * 0.001);
    animate(model.scale, { x: scale, y: scale, z: scale, duration: 600, ease: 'out(3)' });
  });
}

const TREE_RING = 11;
loadModel('fountain-round.glb', { position: [0, 0, 0], scale: 2.4 });
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  const file = i % 2 === 0 ? 'tree-high-round.glb' : 'tree.glb';
  loadModel(file, { position: [Math.cos(a) * TREE_RING, 0, Math.sin(a) * TREE_RING], rotationY: a, scale: 2.2 });
}
loadModel('lantern.glb', { position: [3.5, 0, 3.5], rotationY: -0.6, scale: 2 });
loadModel('lantern.glb', { position: [-3.5, 0, -3.5], rotationY: 2.4, scale: 2 });

// ---------------------------------------------------------------------------
// The girls' characters — 2D sprites standing in the 3D world.
// Each is a flat plane that always turns to face the camera (billboard),
// like Paper Mario. Data + sprites come from assets/characters/.
// ---------------------------------------------------------------------------
const characterGroup = new THREE.Group();
scene.add(characterGroup);
const billboards = [];      // meshes that turn to face the camera each frame
const holdersById = {};     // character id -> its holder Group (for the picker)
let player = null;          // the holder the kid is currently controlling (or null)

const textureLoader = new THREE.TextureLoader();
const CHAR_HEIGHT = 3.4;        // how tall a character stands, in world units
const CHAR_RING = 6.5;          // starting distance from the central fountain

// Characters wander inside this ring — wide enough to roam, but it keeps them
// out of the fountain in the middle and away from the trees on the outside.
const ROAM_INNER = 4, ROAM_OUTER = 9;
const _charDir = new THREE.Vector3();
function pickRoamTarget(holder) {
  const a = Math.random() * Math.PI * 2;
  const r = ROAM_INNER + Math.random() * (ROAM_OUTER - ROAM_INNER);
  holder.userData.target.set(Math.cos(a) * r, 0, Math.sin(a) * r);
}

// A small floating name tag drawn on a canvas, shown above each character.
function makeNameLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 38px -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // pill background
  const w = ctx.measureText(text).width + 36;
  ctx.fillStyle = 'rgba(13,27,42,0.78)';
  const x = 128 - w / 2;
  ctx.beginPath(); ctx.roundRect(x, 10, w, 44, 22); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.6, 0.65, 1);
  return sprite;
}

// Soft round shadow blob placed on the ground under a character.
function makeGroundShadow(radius) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

function placeCharacter(char, index, total) {
  const tex = textureLoader.load(`./assets/characters/${char.sprite}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  // Sprites are square (512x512); keep them square in-world.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CHAR_HEIGHT, CHAR_HEIGHT), mat);
  mesh.userData.char = char; // so a click can find this character's name + lines

  const angle = (index / total) * Math.PI * 2;
  const x = Math.cos(angle) * CHAR_RING;
  const z = Math.sin(angle) * CHAR_RING;
  const baseY = CHAR_HEIGHT / 2; // bottom of the plane sits on the ground

  const holder = new THREE.Group();
  holder.position.set(x, 0, z);
  // each character roams on its own: a target to walk to, its own speed,
  // and a short pause between strolls.
  holder.userData = {
    speed: 1.0 + Math.random() * 0.8,
    target: new THREE.Vector3(x, 0, z),
    pauseUntil: 1 + Math.random() * 2, // settle in before the first stroll
    moving: false,
  };
  mesh.position.y = baseY;
  mesh.userData.baseY = baseY;
  mesh.userData.bobPhase = index * 0.9;
  holder.add(mesh);

  const shadow = makeGroundShadow(CHAR_HEIGHT * 0.32);
  holder.add(shadow);

  const label = makeNameLabel(char.name);
  label.position.set(0, CHAR_HEIGHT + 0.5, 0);
  holder.add(label);

  characterGroup.add(holder);
  billboards.push(mesh);
  holdersById[char.id] = holder;

  // cute entrance: pop up from nothing
  mesh.scale.set(0, 0, 0);
  animate(mesh.scale, { x: 1, y: 1, z: 1, duration: 600, delay: 200 + index * 120, ease: 'out(4)' });
}

// Load the roster (names, stats, moves) the girls designed, then place them.
fetch('./assets/characters/characters.json')
  .then((r) => r.json())
  .then((data) => {
    const roster = data.characters || [];
    roster.forEach((c, i) => placeCharacter(c, i, roster.length));
    // expose the roster + their stats for the game the girls build next
    window.SANDYTEN.roster = roster;
    buildPicker(roster);
    setTimeout(showPicker, 1400); // let them pop in, then ask who to be
  })
  .catch((err) => console.warn('Could not load characters.json', err));

// ---------------------------------------------------------------------------
// Choose-your-character + play as them (walk around, camera follows).
// ---------------------------------------------------------------------------
const PLAYER_SPEED = 7;     // how fast you walk as your character
const PLAY_RADIUS = 26;     // how far you can wander from the center
let pickerEl = null;
let pickerReadyAt = 0; // clicks before this time (during fade-in) are ignored
const hintEl = document.querySelector('#hud .hint');
const changeBtn = document.getElementById('changeBtn');
changeBtn.addEventListener('click', showPicker);

function buildPicker(roster) {
  pickerEl = document.createElement('div');
  pickerEl.id = 'picker';
  const panel = document.createElement('div');
  panel.className = 'picker-panel';
  const h = document.createElement('h2');
  h.append('Choose your ', Object.assign(document.createElement('span'), { textContent: 'character' }), '!');
  const grid = document.createElement('div');
  grid.className = 'picker-grid';
  roster.forEach((c) => {
    const card = document.createElement('button');
    card.className = 'picker-card';
    const img = document.createElement('img');
    img.src = `./assets/characters/${c.sprite}`;
    img.alt = c.name;
    const nm = document.createElement('span');
    nm.textContent = c.name;
    card.append(img, nm);
    card.addEventListener('click', () => {
      if (performance.now() < pickerReadyAt) return; // ignore clicks during fade-in
      playAs(c.id); hidePicker();
    });
    grid.appendChild(card);
  });
  panel.append(h, grid);
  pickerEl.appendChild(panel);
  document.body.appendChild(pickerEl);
}

function showPicker() {
  if (!pickerEl) return;
  pickerEl.style.display = 'flex';
  pickerReadyAt = performance.now() + 350; // brief no-click window during fade-in
  animate(pickerEl, { opacity: [0, 1], duration: 280, ease: 'out(3)' });
}
function hidePicker() {
  if (!pickerEl) return;
  animate(pickerEl, { opacity: [1, 0], duration: 220, onComplete: () => { pickerEl.style.display = 'none'; } });
}

function playAs(id) {
  const holder = holdersById[id];
  if (!holder) return;
  // release any previous character back into roaming
  if (player) player.userData.isPlayer = false;
  player = holder;
  holder.userData.isPlayer = true;
  holder.userData.moving = false;
  holder.userData.pauseUntil = Infinity; // never roam while controlled

  // frame the player with a friendly third-person camera
  const p = holder.position;
  controls.target.set(p.x, 1.5, p.z);
  camera.position.set(p.x + 6, 4.5, p.z + 8);
  controls.minDistance = 4;
  controls.maxDistance = 30;
  controls.update();

  const name = holder.children.find((c) => c.userData?.char)?.userData.char.name
    || (window.SANDYTEN.roster.find((r) => r.id === id) || {}).name || 'your character';
  const strong = document.createElement('strong');
  strong.textContent = name;
  hintEl.replaceChildren('Playing as ', strong, ' — arrow keys / WASD to move · drag to look');
  changeBtn.style.display = '';
}

// Walk around as the chosen character; the camera trails along.
function updatePlayer(dt) {
  if (!player) return;
  const w = player.userData;
  if (keys.size === 0) { w.moving = false; return; }

  camera.getWorldDirection(_forward); _forward.y = 0;
  if (_forward.lengthSq() === 0) { w.moving = false; return; }
  _forward.normalize();
  _right.crossVectors(_forward, camera.up).normalize();

  _move.set(0, 0, 0);
  if (keys.has('forward')) _move.add(_forward);
  if (keys.has('back')) _move.sub(_forward);
  if (keys.has('right')) _move.add(_right);
  if (keys.has('left')) _move.sub(_right);
  if (_move.lengthSq() === 0) { w.moving = false; return; }

  _move.normalize().multiplyScalar(PLAYER_SPEED * dt);
  let nx = player.position.x + _move.x;
  let nz = player.position.z + _move.z;
  const r = Math.hypot(nx, nz);
  if (r > PLAY_RADIUS) { nx = (nx / r) * PLAY_RADIUS; nz = (nz / r) * PLAY_RADIUS; }
  const ddx = nx - player.position.x, ddz = nz - player.position.z;
  player.position.x = nx; player.position.z = nz;
  // camera follows by the same amount, keeping your view steady
  camera.position.x += ddx; camera.position.z += ddz;
  controls.target.x += ddx; controls.target.z += ddz;
  w.moving = true;
}

// ---------------------------------------------------------------------------
// Click (or tap) a character to make it say something.
// A speech bubble (HTML) pops up above whoever you clicked.
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const _headPos = new THREE.Vector3();

const bubbleEl = document.createElement('div');
bubbleEl.className = 'speech';
bubbleEl.style.display = 'none';
bubbleEl.style.opacity = '0';
const bubbleWho = document.createElement('span');
bubbleWho.className = 'who';
const bubbleText = document.createTextNode('');
bubbleEl.append(bubbleWho, bubbleText);
document.body.appendChild(bubbleEl);
let activeBubble = null; // { mesh, hideAt }

function showSpeech(mesh) {
  const char = mesh.userData.char;
  if (!char) return;
  const lines = (char.lines && char.lines.length) ? char.lines : ['Hi!'];
  const text = lines[Math.floor(Math.random() * lines.length)];
  bubbleWho.textContent = char.name;       // safe: no HTML injection
  bubbleText.textContent = text;
  bubbleEl.style.display = 'block';
  positionBubble(mesh); // place it before fading in, so it doesn't jump
  activeBubble = { mesh, hideAt: timer.getElapsed() + 3.4 };
  animate(bubbleEl, { opacity: [0, 1], duration: 260, ease: 'out(3)' });
}

function positionBubble(mesh) {
  mesh.getWorldPosition(_headPos);
  _headPos.y += CHAR_HEIGHT * 0.5; // float above the head
  _headPos.project(camera);
  if (_headPos.z > 1) { bubbleEl.style.display = 'none'; return; } // behind camera
  bubbleEl.style.left = ((_headPos.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  bubbleEl.style.top = ((-_headPos.y * 0.5 + 0.5) * window.innerHeight) + 'px';
}

// Tap detection: only count it as a click if the pointer barely moved
// (so dragging to look around doesn't trigger a speech bubble).
let downX = 0, downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(billboards, false);
  if (hits.length) showSpeech(hits[0].object);
});

// Show a pointer cursor when hovering a character, to invite clicking.
renderer.domElement.addEventListener('pointermove', (e) => {
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  renderer.domElement.style.cursor = raycaster.intersectObjects(billboards, false).length ? 'pointer' : '';
});

// ---------------------------------------------------------------------------
// Collectible stars — walk into one (as your character) to collect it.
// Each pop plays a chime, bumps the counter, and a fresh star appears.
// ---------------------------------------------------------------------------
function makeStarGeometry() {
  const shape = new THREE.Shape();
  const spikes = 5, outer = 0.6, inner = 0.28;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2,
  });
  geo.center();
  return geo;
}
const STAR_GEO = makeStarGeometry();
const STAR_MAT = new THREE.MeshStandardMaterial({
  color: 0xffd54a, emissive: 0xffb300, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.3,
});
const STAR_COUNT = 14;
const STAR_Y = 1.2;

const collectibles = new THREE.Group();
scene.add(collectibles);

function spawnStar() {
  const m = new THREE.Mesh(STAR_GEO, STAR_MAT);
  const a = Math.random() * Math.PI * 2;
  const r = 4 + Math.random() * (PLAY_RADIUS - 6); // spread across the play area
  m.position.set(Math.cos(a) * r, STAR_Y, Math.sin(a) * r);
  m.userData.spin = 1 + Math.random();
  m.userData.bob = Math.random() * Math.PI * 2;
  m.castShadow = true;
  m.scale.setScalar(0);
  animate(m.scale, { x: 1, y: 1, z: 1, duration: 400, ease: 'out(3)' });
  collectibles.add(m);
}
for (let i = 0; i < STAR_COUNT; i++) spawnStar();

// score
let score = 0;
const scoreEl = document.getElementById('score');
function addScore() {
  score += 1;
  scoreEl.textContent = '⭐ ' + score;
  animate(scoreEl, { scale: [1.4, 1], duration: 320, ease: 'out(3)' }); // little pop
}

// happy "ding" using the Web Audio API (no sound file needed).
// Created lazily on first collect, which always follows a user gesture.
let audioCtx = null;
function playDing() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, now);
    o.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // cheerful up-chirp
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o.connect(g).connect(audioCtx.destination);
    o.start(now);
    o.stop(now + 0.26);
  } catch (e) { /* audio not available — no problem */ }
}

const COLLECT_DIST2 = 1.7 * 1.7;
function updateCollectibles(t, dt) {
  // spin + bob every star
  for (const s of collectibles.children) {
    if (s.userData.collected) continue;
    s.rotation.y += s.userData.spin * dt;
    s.position.y = STAR_Y + Math.sin(t * 2 + s.userData.bob) * 0.18;
  }
  // collect when the player walks close enough
  if (!player) return;
  const px = player.position.x, pz = player.position.z;
  for (const s of collectibles.children) {
    if (s.userData.collected) continue;
    const dx = s.position.x - px, dz = s.position.z - pz;
    if (dx * dx + dz * dz < COLLECT_DIST2) {
      s.userData.collected = true;
      playDing();
      addScore();
      // sparkle up and shrink away, then remove and spawn a fresh one
      animate(s.position, { y: s.position.y + 1.6, duration: 420, ease: 'out(2)' });
      animate(s.rotation, { y: s.rotation.y + 6, duration: 420 });
      animate(s.scale, {
        x: 0, y: 0, z: 0, duration: 420, ease: 'in(2)',
        onComplete: () => { collectibles.remove(s); spawnStar(); },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Post-processing — subtle bloom for that "production" glow
// ---------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.28, // strength — gentle, so bright sprites (like Boo) don't blow out
  0.5,  // radius
  0.92  // threshold — only the brightest pixels glow
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Keyboard movement — arrow keys (and WASD) glide you across the world.
// Movement is relative to where the camera faces: Up = forward, Down = back,
// Left/Right = strafe. Drag-to-look and scroll-zoom still work alongside it.
// ---------------------------------------------------------------------------
const keys = new Set();
const MOVE_SPEED = 12; // world units per second

const MOVE_KEYS = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

window.addEventListener('keydown', (e) => {
  if (MOVE_KEYS[e.code]) { keys.add(MOVE_KEYS[e.code]); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (MOVE_KEYS[e.code]) keys.delete(MOVE_KEYS[e.code]);
});
// Stop drifting if focus leaves the page mid-press.
window.addEventListener('blur', () => keys.clear());

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

function updateMovement(dt) {
  if (keys.size === 0) return;

  // Camera forward, flattened onto the ground plane.
  camera.getWorldDirection(_forward);
  _forward.y = 0;
  if (_forward.lengthSq() === 0) return;
  _forward.normalize();
  _right.crossVectors(_forward, camera.up).normalize();

  _move.set(0, 0, 0);
  if (keys.has('forward')) _move.add(_forward);
  if (keys.has('back')) _move.sub(_forward);
  if (keys.has('right')) _move.add(_right);
  if (keys.has('left')) _move.sub(_right);
  if (_move.lengthSq() === 0) return;

  _move.normalize().multiplyScalar(MOVE_SPEED * dt);
  // Move camera and look-at target together so you glide over the world.
  camera.position.add(_move);
  controls.target.add(_move);
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
let frames = 0, fpsLast = 0;
const fpsEl = document.getElementById('fps');

function tick() {
  timer.update();
  const t = timer.getElapsed();
  const dt = timer.getDelta();

  crystals.children.forEach((c, i) => {
    c.rotation.y += c.userData.spin * dt;
    c.position.y = c.userData.baseY + Math.sin(t * 1.2 + i) * 0.4;
  });

  // Move first (player walks / free camera), then update characters' facing & bob.
  if (player) updatePlayer(dt); else updateMovement(dt);

  updateCollectibles(t, dt);

  // Characters: wander around, face the camera (upright billboard), and bob/hop.
  for (const b of billboards) {
    const holder = b.parent;
    const w = holder.userData;

    // roam toward the current target, then pause and pick a new one.
    // The player-controlled character skips roaming — updatePlayer() (run
    // earlier this frame) sets its position and `moving` flag instead.
    if (!w.isPlayer) {
      if (t >= w.pauseUntil) {
        _charDir.set(w.target.x - holder.position.x, 0, w.target.z - holder.position.z);
        const dist = _charDir.length();
        if (dist < 0.25) {
          w.moving = false;
          w.pauseUntil = t + 0.6 + Math.random() * 1.8; // rest a moment
          pickRoamTarget(holder);
        } else {
          w.moving = true;
          const step = Math.min(w.speed * dt, dist);
          holder.position.x += (_charDir.x / dist) * step;
          holder.position.z += (_charDir.z / dist) * step;
        }
      } else {
        w.moving = false;
      }
    }

    // always turn to face the camera, staying upright
    b.rotation.y = Math.atan2(
      camera.position.x - holder.position.x,
      camera.position.z - holder.position.z
    );

    // little hop while walking, gentle float while resting
    b.position.y = w.moving
      ? b.userData.baseY + Math.abs(Math.sin(t * 9 + b.userData.bobPhase)) * 0.22
      : b.userData.baseY + Math.sin(t * 1.6 + b.userData.bobPhase) * 0.1;
  }

  // Keep an open speech bubble glued above its character, and auto-hide it.
  if (activeBubble) {
    if (t >= activeBubble.hideAt) {
      activeBubble = null;
      animate(bubbleEl, { opacity: 0, duration: 240, onComplete: () => {
        if (!activeBubble) bubbleEl.style.display = 'none';
      } });
    } else {
      positionBubble(activeBubble.mesh);
    }
  }

  controls.update();
  composer.render();

  // FPS readout
  frames++;
  if (t - fpsLast >= 0.5) {
    fpsEl.textContent = Math.round(frames / (t - fpsLast)) + ' fps';
    frames = 0; fpsLast = t;
  }
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Intro sequence (anime.js) — drive the loading screen, then reveal the world
// ---------------------------------------------------------------------------
function runIntro() {
  const loader = document.getElementById('loader');
  const hud = document.getElementById('hud');

  createTimeline({ defaults: { ease: 'out(3)' } })
    .add('#loader .title', { opacity: [0, 1], translateY: [20, 0], duration: 600 })
    .add('#loader .sub', { opacity: [0, 1], duration: 400 }, '-=300')
    .add('#loader .bar > i', { width: ['0%', '100%'], duration: 900, ease: 'inOut(2)' }, '-=200')
    .add('#loader', {
      opacity: [1, 0],
      duration: 500,
      onComplete: () => { loader.style.display = 'none'; },
    }, '+=150')
    .add(hud, { opacity: [0, 1], duration: 600 }, '-=200')
    // Pop the crystals in with a staggered, springy entrance.
    // anime.js animates numeric props on any object — here each crystal's
    // THREE.Vector3 scale (x/y/z) directly.
    .add(crystals.children.map((c) => c.scale), {
      x: [0, 1], y: [0, 1], z: [0, 1],
      duration: 700,
      delay: stagger(90),
      ease: 'out(4)',
    }, '-=400');
}

// Start rendering immediately, then run the reveal.
tick();
runIntro();

// Expose the scene graph for quick tinkering from the console / future code.
window.SANDYTEN = { THREE, scene, camera, renderer, controls, composer, crystals, setSun, animate, utils };
