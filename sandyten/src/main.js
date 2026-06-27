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
skyU.turbidity.value = 3;       // clearer sky, less white haze
skyU.rayleigh.value = 1.1;      // softer blue gradient, not blown out
skyU.mieCoefficient.value = 0.003;
skyU.mieDirectionalG.value = 0.75;

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

// Lamp posts around the courtyard that light up at night.
const lampPosts = [];
function makeLampPost(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 2.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x46484f, roughness: 0.7 })
  );
  pole.position.y = 1.4; pole.castShadow = true; g.add(pole);
  const orbMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd97a, emissiveIntensity: 0.15, roughness: 0.4 });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), orbMat);
  orb.position.y = 2.95; g.add(orb);
  const light = new THREE.PointLight(0xffcf7a, 0, 10, 2); // intensity toggled by day/night
  light.position.set(0, 2.95, 0); g.add(light);
  g.position.set(x, 0, z); scene.add(g);
  lampPosts.push({ orbMat, light });
}
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.4;
  makeLampPost(Math.cos(a) * 9.5, Math.sin(a) * 9.5);
}

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
  // Half the time, head for the nearest star (so NPCs collect stars too);
  // otherwise wander to a random spot.
  if (Math.random() < 0.5 && typeof collectibles !== 'undefined' && collectibles.children.length) {
    let best = null, bestD = Infinity;
    for (const s of collectibles.children) {
      if (s.userData.collected) continue;
      const d = (s.position.x - holder.position.x) ** 2 + (s.position.z - holder.position.z) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best) { holder.userData.target.set(best.position.x, 0, best.position.z); return; }
  }
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

// A floating "💤" shown above a character while it sleeps.
function makeZzzSprite() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.font = '92px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('💤', 64, 72);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.2, 1.2, 1);
  s.visible = false;
  return s;
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
  mesh.userData.accessories = {}; // id -> worn item mesh for this character
  mesh.userData.itemColors = {};  // id -> chosen tint for recolorable clothes
  holder.userData.mesh = mesh;    // quick handle for styling
  holder.add(mesh);

  const shadow = makeGroundShadow(CHAR_HEIGHT * 0.32);
  holder.add(shadow);

  const label = makeNameLabel(char.name);
  label.position.set(0, CHAR_HEIGHT + 0.5, 0);
  holder.add(label);

  const zzz = makeZzzSprite();
  zzz.position.set(1.05, CHAR_HEIGHT + 1.0, 0);
  holder.add(zzz);
  holder.userData.zzz = zzz;

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
    placeHouses(roster); // a little house for each character
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
  // release the previous character back into roaming (don't leave it standing)
  if (player && player !== holder) {
    player.userData.isPlayer = false;
    player.userData.moving = false;
    player.userData.pauseUntil = 0; // start strolling again right away
    player.position.y = 0;          // drop back to the ground (in case it was upstairs)
    pickRoamTarget(player);         // give it a fresh place to wander to
  }
  player = holder;
  holder.position.y = 0;            // start on the ground
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
  const move = document.body.classList.contains('touch') ? 'joystick to move · drag to look' : 'arrow keys / WASD to move · drag to look';
  hintEl.replaceChildren('Playing as ', strong, ' — ' + move);
  changeBtn.style.display = '';
}

// Walk around as the chosen character; the camera trails along.
function updatePlayer(dt) {
  if (!player) return;
  const w = player.userData;
  if (keys.size === 0 && !joyVec.active) { w.moving = false; return; }

  camera.getWorldDirection(_forward); _forward.y = 0;
  if (_forward.lengthSq() === 0) { w.moving = false; return; }
  _forward.normalize();
  _right.crossVectors(_forward, camera.up).normalize();

  _move.set(0, 0, 0);
  if (keys.has('forward')) _move.add(_forward);
  if (keys.has('back')) _move.sub(_forward);
  if (keys.has('right')) _move.add(_right);
  if (keys.has('left')) _move.sub(_right);
  if (joyVec.active) { _move.addScaledVector(_forward, -joyVec.y); _move.addScaledVector(_right, joyVec.x); }
  if (_move.lengthSq() === 0) { w.moving = false; return; }

  _move.normalize().multiplyScalar(PLAYER_SPEED * dt);
  let nx = player.position.x + _move.x;
  let nz = player.position.z + _move.z;
  const r = Math.hypot(nx, nz);
  if (r > PLAY_RADIUS) { nx = (nx / r) * PLAY_RADIUS; nz = (nz / r) * PLAY_RADIUS; }
  // walls block everyone except Boo the ghost (he phases right through)
  const isBoo = player.userData.mesh?.userData.char?.id === 'boo';
  if (!isBoo) { [nx, nz] = resolveWalls(nx, nz, player.position.x, player.position.z); }
  const ddx = nx - player.position.x, ddz = nz - player.position.z;
  player.position.x = nx; player.position.z = nz;
  // camera follows by the same amount, keeping your view steady
  camera.position.x += ddx; camera.position.z += ddz;
  controls.target.x += ddx; controls.target.z += ddz;
  // vertical: rise/lower with the stairs & loft inside houses
  const fy = houseFloorHeight(nx, nz);
  const ddy = fy - player.position.y;
  if (Math.abs(ddy) > 1e-4) {
    player.position.y = fy;
    camera.position.y += ddy;
    controls.target.y += ddy;
  }
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
  renderScore();
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

function collectStar(s, byPlayer) {
  s.userData.collected = true;
  if (byPlayer) { playDing(); addScore(); } // only the player earns money
  // sparkle up and shrink away, then remove and spawn a fresh one
  animate(s.position, { y: s.position.y + 1.6, duration: 420, ease: 'out(2)' });
  animate(s.rotation, { y: s.rotation.y + 6, duration: 420 });
  animate(s.scale, {
    x: 0, y: 0, z: 0, duration: 420, ease: 'in(2)',
    onComplete: () => { collectibles.remove(s); spawnStar(); },
  });
}

const COLLECT_DIST2 = 1.7 * 1.7;       // player reach
const NPC_COLLECT_DIST2 = 1.3 * 1.3;   // NPCs need to be a bit closer
function updateCollectibles(t, dt) {
  // spin + bob every star
  for (const s of collectibles.children) {
    if (s.userData.collected) continue;
    s.rotation.y += s.userData.spin * dt;
    s.position.y = STAR_Y + Math.sin(t * 2 + s.userData.bob) * 0.18;
  }
  // the player collects (and earns) when walking close enough
  if (player) {
    const px = player.position.x, pz = player.position.z;
    for (const s of collectibles.children) {
      if (s.userData.collected) continue;
      const dx = s.position.x - px, dz = s.position.z - pz;
      if (dx * dx + dz * dz < COLLECT_DIST2) collectStar(s, true);
    }
  }
  // the other characters collect stars too (just for fun — no money)
  for (const b of billboards) {
    const h = b.parent;
    if (h.userData.isPlayer || h.userData.isShopkeeper) continue;
    for (const s of collectibles.children) {
      if (s.userData.collected) continue;
      const dx = s.position.x - h.position.x, dz = s.position.z - h.position.z;
      if (dx * dx + dz * dz < NPC_COLLECT_DIST2) { collectStar(s, false); break; }
    }
  }
}

// ---------------------------------------------------------------------------
// THE STORE — a little building with a sign, a shopkeeper inside, and a shop
// where you spend your collected stars on food, clothes, and more.
// ---------------------------------------------------------------------------
function makeSign(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff8e7';
  x.beginPath(); x.roundRect(8, 8, 496, 112, 18); x.fill();
  x.lineWidth = 8; x.strokeStyle = '#c0563f'; x.stroke();
  x.fillStyle = '#c0563f';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  let fontSize = 62; // shrink to fit long names like "DRESSING ROOM"
  do {
    x.font = `bold ${fontSize}px -apple-system, Segoe UI, sans-serif`;
    if (x.measureText(text).width <= 460) break;
    fontSize -= 4;
  } while (fontSize > 26);
  x.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  );
  return board;
}

function buildStore() {
  const store = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xead9b0, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc0563f, roughness: 0.8 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xd8c59a, roughness: 1 });

  const W = 9, D = 6, H = 4, T = 0.4, DOOR = 4;
  const parts = [];
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parts.push(m); return m;
  };
  box(W, H, T, wallMat, 0, H / 2, -D / 2);                       // back wall
  box(T, H, D, wallMat, -W / 2, H / 2, 0);                       // left wall
  box(T, H, D, wallMat, W / 2, H / 2, 0);                        // right wall
  const fw = (W - DOOR) / 2;                                     // front: leave a doorway
  box(fw, H, T, wallMat, -(W / 2 - fw / 2), H / 2, D / 2);
  box(fw, H, T, wallMat, (W / 2 - fw / 2), H / 2, D / 2);
  box(DOOR, 0.9, T, wallMat, 0, H - 0.45, D / 2);               // lintel over the door
  box(W + 0.9, 0.5, D + 0.9, roofMat, 0, H + 0.25, 0);          // roof slab
  box(W, 0.1, D, floorMat, 0, 0.05, 0);                        // floor
  box(W - 2, 1.2, 0.8, woodMat, 0, 0.6, -D / 2 + 2);           // shop counter

  parts.forEach((m) => { m.castShadow = true; m.receiveShadow = true; store.add(m); });

  const sign = makeSign('THE STORE');
  sign.position.set(0, H + 1.3, D / 2 - 0.05);                  // on top, facing the courtyard
  store.add(sign);

  store.position.set(0, 0, -16);
  scene.add(store);
}
buildStore();

// The HOSPITAL — on the other (east) side of THE STORE.
function buildHospital() {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd2d8de, roughness: 0.8 });
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xe23b3b, roughness: 0.5, emissive: 0x4a0000, emissiveIntensity: 0.2 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xe3e8ec, roughness: 1 });
  const bedW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const bedFrame = new THREE.MeshStandardMaterial({ color: 0xb9c0c7, roughness: 0.6 });

  const W = 9, D = 6, H = 4, T = 0.4, DOOR = 4;
  const parts = [];
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parts.push(m); return m;
  };
  box(W, H, T, wallMat, 0, H / 2, -D / 2);
  box(T, H, D, wallMat, -W / 2, H / 2, 0);
  box(T, H, D, wallMat, W / 2, H / 2, 0);
  const fw = (W - DOOR) / 2;
  box(fw, H, T, wallMat, -(W / 2 - fw / 2), H / 2, D / 2);
  box(fw, H, T, wallMat, (W / 2 - fw / 2), H / 2, D / 2);
  box(DOOR, 0.9, T, wallMat, 0, H - 0.45, D / 2);
  box(W + 0.9, 0.5, D + 0.9, roofMat, 0, H + 0.25, 0);
  box(W, 0.1, D, floorMat, 0, 0.05, 0);
  // red crosses on the two front wall pieces
  for (const cx of [-(W / 2 - fw / 2), (W / 2 - fw / 2)]) {
    box(0.35, 1.3, 0.1, crossMat, cx, 2.2, D / 2 + 0.06);
    box(1.0, 0.4, 0.1, crossMat, cx, 2.2, D / 2 + 0.06);
  }
  // a hospital bed inside
  box(2.0, 0.5, 1.0, bedFrame, -2.2, 0.3, -D / 2 + 1.6);
  box(1.9, 0.22, 0.95, bedW, -2.2, 0.6, -D / 2 + 1.6);
  box(0.55, 0.2, 0.85, bedW, -2.85, 0.78, -D / 2 + 1.6); // pillow

  parts.forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });

  const sign = makeSign('HOSPITAL');
  sign.position.set(0, H + 1.3, D / 2 - 0.05);
  g.add(sign);

  g.position.set(14, 0, -14);
  scene.add(g);
}
buildHospital();

// A standing billboard NPC (shopkeeper, doctor, …) that never roams.
function addStandee(file, name, pos) {
  const tex = textureLoader.load(`./assets/characters/${file}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CHAR_HEIGHT, CHAR_HEIGHT),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
  );
  const baseY = CHAR_HEIGHT / 2;
  mesh.position.y = baseY;
  mesh.userData.baseY = baseY;
  mesh.userData.bobPhase = 0.5;
  const holder = new THREE.Group();
  holder.position.copy(pos);
  holder.userData = { isShopkeeper: true }; // "static NPC": doesn't roam, not collectible
  holder.add(mesh);
  const label = makeNameLabel(name);
  label.position.set(0, CHAR_HEIGHT + 0.5, 0);
  holder.add(label);
  scene.add(holder);
  billboards.push(mesh);
}
const SHOPKEEPER_POS = new THREE.Vector3(0, 0, -17.6);
addStandee('shopkeeper.png', 'Shopkeeper', SHOPKEEPER_POS);
addStandee('doctor.png', 'Doctor', new THREE.Vector3(14, 0, -15.8)); // inside the hospital

// ---------------------------------------------------------------------------
// Campfire in the middle of town — stones, logs, flickering flames + warm light.
// ---------------------------------------------------------------------------
const campfire = { flames: [], light: null };
function buildCampfire(x, z) {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8c8782, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), stoneMat);
    s.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85); s.castShadow = true; g.add(s);
  }
  const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 7), logMat);
    log.rotation.z = Math.PI / 2; log.rotation.y = i * 1.1; log.position.y = 0.16; log.castShadow = true; g.add(log);
  }
  const flameColors = [0xff5a1a, 0xffa523, 0xffe04a];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(0.3 - i * 0.07, 0.95 - i * 0.2, 8),
      new THREE.MeshBasicMaterial({ color: flameColors[i] })
    );
    f.position.set((i - 1) * 0.08, 0.55 - i * 0.08, 0);
    f.userData.phase = Math.random() * Math.PI * 2;
    g.add(f); campfire.flames.push(f);
  }
  campfire.light = new THREE.PointLight(0xff8a30, 1.4, 13, 2);
  campfire.light.position.set(0, 1, 0); g.add(campfire.light);
  g.position.set(x, 0, z); scene.add(g);
}
buildCampfire(0, 5.5);
function updateCampfire(t) {
  const flick = 0.82 + Math.sin(t * 12) * 0.1 + Math.sin(t * 23.3) * 0.08;
  for (const f of campfire.flames) {
    f.scale.y = 0.85 + Math.sin(t * 10 + f.userData.phase) * 0.22;
    f.rotation.y = t * 2 + f.userData.phase;
  }
  if (campfire.light) campfire.light.intensity = (isNight ? 2.4 : 1.1) * flick;
}

// ---------------------------------------------------------------------------
// Ambulance parked by the hospital, with a blinking red/blue light bar.
// ---------------------------------------------------------------------------
const ambulanceLights = [];
function buildAmbulance(x, z, ry) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.55, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.4 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe23b3b, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 1.6), white); body.position.y = 1.05; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 1.55), white); cab.position.set(1.7, 0.85, 0); g.add(cab);
  const wind = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 1.4), dark); wind.position.set(2.2, 1.1, 0); g.add(wind);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.26), red).translateX(-0.4).translateY(1.1).translateZ(0.81));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.8), red).translateX(-0.4).translateY(1.1).translateZ(0.81));
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14);
  for (const wx of [1.3, -1.1]) for (const wz of [0.82, -0.82]) {
    const w = new THREE.Mesh(wheelGeo, dark); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.4, wz); g.add(w);
  }
  const rl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff0000, emissiveIntensity: 0.6 }));
  rl.position.set(0.25, 1.9, 0); g.add(rl);
  const bl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a6bff, emissive: 0x0030ff, emissiveIntensity: 0.6 }));
  bl.position.set(-0.25, 1.9, 0); g.add(bl);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  ambulanceLights.push(rl.material, bl.material);
}
buildAmbulance(9.5, -9.5, -0.6);
function updateAmbulance(t) {
  if (ambulanceLights.length < 2) return;
  const on = Math.sin(t * 6) > 0;
  ambulanceLights[0].emissiveIntensity = on ? 1.5 : 0.2; // red
  ambulanceLights[1].emissiveIntensity = on ? 0.2 : 1.5; // blue (alternates)
}

// ---- Shop UI: walk up to the shopkeeper to open it; spend stars to buy ----
const SHOP_ITEMS = [
  { emoji: '🍎', name: 'Apple', price: 3 },
  { emoji: '🍰', name: 'Cake', price: 5 },
  { emoji: '🍕', name: 'Pizza', price: 7 },
  { emoji: '🧢', name: 'Hat', price: 6 },
  { emoji: '👗', name: 'Dress', price: 10 },
  { emoji: '👑', name: 'Crown', price: 15 },
  { emoji: '🪄', name: 'Star Wand', price: 20 },
];
const owned = {};
let shopEl = null, shopOpen = false, shopMsgEl = null, ownedEl = null;
const shopRows = [];

function renderScore() { scoreEl.textContent = '⭐ ' + score; }

function buildShop() {
  shopEl = document.createElement('div');
  shopEl.id = 'shop';
  shopEl.style.display = 'none';
  const h = document.createElement('h3');
  h.append('🏪 THE STORE');
  const sub = document.createElement('p');
  sub.className = 'shop-sub';
  sub.textContent = 'Pay with ⭐ stars!';
  const list = document.createElement('div');
  list.className = 'shop-list';
  SHOP_ITEMS.forEach((item) => {
    const row = document.createElement('button');
    row.className = 'shop-item';
    const lbl = document.createElement('span');
    lbl.textContent = `${item.emoji} ${item.name}`;
    const price = document.createElement('span');
    price.className = 'shop-price';
    price.textContent = `${item.price} ⭐`;
    row.append(lbl, price);
    row.addEventListener('click', () => buyItem(item));
    list.appendChild(row);
    shopRows.push({ item, row });
  });
  shopMsgEl = document.createElement('p');
  shopMsgEl.className = 'shop-msg';
  ownedEl = document.createElement('p');
  ownedEl.className = 'shop-owned';
  shopEl.append(h, sub, list, shopMsgEl, ownedEl);
  document.body.appendChild(shopEl);
}

function refreshShop() {
  shopRows.forEach(({ item, row }) => {
    row.classList.toggle('cant-afford', score < item.price);
  });
}

function updateOwned() {
  const have = Object.entries(owned).filter(([, n]) => n > 0);
  if (!have.length) { ownedEl.textContent = ''; return; }
  const icons = SHOP_ITEMS.filter((i) => owned[i.name]).map((i) => i.emoji.repeat(owned[i.name])).join(' ');
  ownedEl.textContent = 'Yours: ' + icons;
}

function buyItem(item) {
  if (score < item.price) {
    shopMsgEl.textContent = `Not enough — you need ${item.price} ⭐!`;
    animate(shopMsgEl, { opacity: [0.3, 1], duration: 220 });
    return;
  }
  score -= item.price;
  renderScore();
  animate(scoreEl, { scale: [1.3, 1], duration: 300, ease: 'out(3)' });
  owned[item.name] = (owned[item.name] || 0) + 1;
  shopMsgEl.textContent = `You bought ${item.emoji} ${item.name}!`;
  animate(shopMsgEl, { scale: [1.2, 1], opacity: [0.4, 1], duration: 300, ease: 'out(3)' });
  updateOwned();
  refreshShop();
}

function openShop() {
  shopOpen = true;
  refreshShop();
  shopEl.style.display = 'block';
  // opacity only — the panel's vertical centering uses CSS transform, so we
  // must not animate transform here or it would jump.
  animate(shopEl, { opacity: [0, 1], duration: 240, ease: 'out(3)' });
}
function closeShop() {
  shopOpen = false;
  animate(shopEl, { opacity: [1, 0], duration: 200, onComplete: () => { shopEl.style.display = 'none'; } });
}
buildShop();

// Open the shop when the player walks up to the shopkeeper.
function updateShop() {
  let near = false;
  if (player) {
    const dx = player.position.x - SHOPKEEPER_POS.x;
    const dz = player.position.z - SHOPKEEPER_POS.z;
    near = (dx * dx + dz * dz) < 5.5 * 5.5;
  }
  if (near && !shopOpen) openShop();
  else if (!near && shopOpen) closeShop();
}

// ---------------------------------------------------------------------------
// DRESSING ROOM — walk in to buy accessories and style your character.
// Accessories are little sprites layered over the character's head/face.
// ---------------------------------------------------------------------------
const DRESS_CENTER = new THREE.Vector3(-14, 0, -13);
const DRESS_POS = new THREE.Vector3(-14, 0, -10.5); // where you stand to style

function buildDressingRoom() {
  const room = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe7c6e0, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8e6fb0, roughness: 0.8 });
  const mirrorFrame = new THREE.MeshStandardMaterial({ color: 0xb98bd6, roughness: 0.7 });
  const mirrorGlass = new THREE.MeshStandardMaterial({ color: 0xd9f0ff, emissive: 0x9fd8ff, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.2 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xead2e6, roughness: 1 });

  const W = 8, D = 6, H = 4, T = 0.4, DOOR = 4;
  const parts = [];
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parts.push(m); return m;
  };
  box(W, H, T, wallMat, 0, H / 2, -D / 2);
  box(T, H, D, wallMat, -W / 2, H / 2, 0);
  box(T, H, D, wallMat, W / 2, H / 2, 0);
  const fw = (W - DOOR) / 2;
  box(fw, H, T, wallMat, -(W / 2 - fw / 2), H / 2, D / 2);
  box(fw, H, T, wallMat, (W / 2 - fw / 2), H / 2, D / 2);
  box(DOOR, 0.9, T, wallMat, 0, H - 0.45, D / 2);
  box(W + 0.9, 0.5, D + 0.9, roofMat, 0, H + 0.25, 0);
  box(W, 0.1, D, floorMat, 0, 0.05, 0);
  // a mirror on the back wall
  box(2.4, 3.2, 0.2, mirrorFrame, 2.2, 1.8, -D / 2 + 0.25);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.7), mirrorGlass);
  glass.position.set(2.2, 1.8, -D / 2 + 0.36); parts.push(glass);

  parts.forEach((m) => { m.castShadow = true; m.receiveShadow = true; room.add(m); });

  const sign = makeSign('DRESSING ROOM');
  sign.position.set(0, H + 1.3, D / 2 - 0.05);
  room.add(sign);

  room.position.copy(DRESS_CENTER);
  scene.add(room);
}
buildDressingRoom();

// ---------------------------------------------------------------------------
// A little house for each character, ringed around the south of the world,
// each colored to match its character, with a nameplate over the door.
// ---------------------------------------------------------------------------
const HOUSE_COLORS = {
  kiki:   { wall: 0xbfe9f0, roof: 0xff9ec7 },
  bronte: { wall: 0xcfe8b0, roof: 0x6fae54 },
  spike:  { wall: 0xd6f0a0, roof: 0x7bc043 },
  cliff:  { wall: 0xd9d2c5, roof: 0x8a8276 },
  boo:    { wall: 0xece8f6, roof: 0xb9a7e0 },
  lloyd:  { wall: 0xcdbfe0, roof: 0x6b4f9e },
};

// --- Wall collision: walls block everyone except Boo (the ghost). ---
const wallSegments = [];      // world-space 2D line segments of solid walls
const PLAYER_RADIUS = 0.55;
function rotXZ(lx, lz, ry) { const c = Math.cos(ry), s = Math.sin(ry); return [lx * c + lz * s, -lx * s + lz * c]; }
function addWall(gx, gz, ry, lx1, lz1, lx2, lz2) {
  const [x1, z1] = rotXZ(lx1, lz1, ry);
  const [x2, z2] = rotXZ(lx2, lz2, ry);
  wallSegments.push({ x1: x1 + gx, z1: z1 + gz, x2: x2 + gx, z2: z2 + gz });
}
function resolveWalls(x, z, fromX, fromZ) {
  for (const s of wallSegments) {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
    const L2 = dx * dx + dz * dz || 1;
    let t = ((x - s.x1) * dx + (z - s.z1) * dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = s.x1 + t * dx, cz = s.z1 + t * dz;
    let ox = x - cx, oz = z - cz;
    let d = Math.hypot(ox, oz);
    if (d < PLAYER_RADIUS) {
      if (d < 1e-4) { ox = x - fromX; oz = z - fromZ; d = Math.hypot(ox, oz) || 1; }
      ox /= d; oz /= d;
      const push = PLAYER_RADIUS - d;
      x += ox * push; z += oz * push;
    }
  }
  return [x, z];
}

// House dimensions + the stairs/loft layout (shared with houseFloorHeight).
const HOUSE_W = 5, HOUSE_D = 5, HOUSE_T = 0.35, HOUSE_DOOR = 1.9;
const HOUSE_H1 = 3.0, HOUSE_H2 = 2.4;
const LOFT_Y = HOUSE_H1 + 0.1;                 // height you stand at on the loft
const STAIR_FRONT_Z = 0.8, STAIR_BACK_Z = -0.6; // stairs run between these (local z)
const houses = []; // { x, z, ry } for the floor-height lookup

function buildHouse({ x, z, rotationY, name, wall, roof }) {
  const g = new THREE.Group();
  const W = HOUSE_W, D = HOUSE_D, T = HOUSE_T, DOOR = HOUSE_DOOR, H1 = HOUSE_H1, H2 = HOUSE_H2;
  const y2 = H1 + 0.12;
  const wallMat = new THREE.MeshStandardMaterial({ color: wall, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.8 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xcdbb98, roughness: 1 });
  const stepMat = new THREE.MeshStandardMaterial({ color: 0xb79a6f, roughness: 0.95 });
  const parts = [];
  const box = (w, h, d, mat, px, py, pz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz); parts.push(m); return m;
  };

  // ground-floor walls (doorway in the front)
  box(W, H1, T, wallMat, 0, H1 / 2, -D / 2);
  box(T, H1, D, wallMat, -W / 2, H1 / 2, 0);
  box(T, H1, D, wallMat, W / 2, H1 / 2, 0);
  const fw = (W - DOOR) / 2;
  box(fw, H1, T, wallMat, -(W / 2 - fw / 2), H1 / 2, D / 2);
  box(fw, H1, T, wallMat, (W / 2 - fw / 2), H1 / 2, D / 2);
  box(DOOR, 0.5, T, wallMat, 0, H1 - 0.25, D / 2);   // lintel over the door
  box(W, 0.1, D, floorMat, 0, 0.05, 0);              // ground slab

  // second-floor (upper) walls — back + sides only; the FRONT is left open
  // (dollhouse style) so you can see your character up on the loft.
  box(W, H2, T, wallMat, 0, y2 + H2 / 2, -D / 2);
  box(T, H2, D, wallMat, -W / 2, y2 + H2 / 2, 0);
  box(T, H2, D, wallMat, W / 2, y2 + H2 / 2, 0);
  // little railings at the open loft edge (sides), leaving the middle clear
  box(1.3, 0.45, 0.15, wallMat, -1.7, LOFT_Y + 0.22, STAIR_BACK_Z);
  box(1.3, 0.45, 0.15, wallMat, 1.7, LOFT_Y + 0.22, STAIR_BACK_Z);

  // loft floor over the back of the house — this is the "upstairs"
  const loftDepth = STAIR_BACK_Z - (-D / 2);
  box(W, 0.2, loftDepth, floorMat, 0, H1, (-D / 2 + STAIR_BACK_Z) / 2);

  // a staircase up to the loft (stacked solid steps)
  const STEPS = 6, run = (STAIR_FRONT_Z - STAIR_BACK_Z) / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const topY = (i + 1) / STEPS * H1;
    box(W - 0.5, topY, run + 0.02, stepMat, 0, topY / 2, STAIR_FRONT_Z - (i + 0.5) * run);
  }

  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(W * 0.82, 1.8, 4), roofMat); // pyramid roof
  roofMesh.position.set(0, y2 + H2 + 0.9, 0);
  roofMesh.rotation.y = Math.PI / 4;
  parts.push(roofMesh);

  parts.forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });

  // --- furniture ---
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.9 });
  const sheet = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.8 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd97a, emissiveIntensity: 0.7, roughness: 0.6 });
  const furn = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); };
  // downstairs — in the front area by the door
  furn(new THREE.CylinderGeometry(1.0, 1.0, 0.04, 20), accentMat, 0, 0.09, 1.55);   // rug
  furn(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16), wood, 1.4, 0.72, 1.6);       // table top
  furn(new THREE.CylinderGeometry(0.1, 0.14, 0.72, 10), wood, 1.4, 0.36, 1.6);      // table leg
  furn(new THREE.BoxGeometry(0.5, 0.1, 0.5), wood, 0.4, 0.5, 1.75);                  // chair seat
  furn(new THREE.BoxGeometry(0.5, 0.55, 0.1), wood, 0.4, 0.78, 1.98);               // chair back
  furn(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), wood, -1.7, 0.65, 1.7);      // lamp pole
  furn(new THREE.ConeGeometry(0.32, 0.4, 12), lampMat, -1.7, 1.45, 1.7);            // lamp shade
  // upstairs — a bed on the loft
  furn(new THREE.BoxGeometry(2.0, 0.35, 1.0), wood, 0, LOFT_Y + 0.18, -1.5);        // bed base
  furn(new THREE.BoxGeometry(1.9, 0.2, 0.9), sheet, 0, LOFT_Y + 0.42, -1.5);        // mattress
  furn(new THREE.BoxGeometry(0.5, 0.18, 0.8), accentMat, -0.7, LOFT_Y + 0.55, -1.5); // pillow
  furn(new THREE.BoxGeometry(1.3, 0.14, 0.9), accentMat, 0.3, LOFT_Y + 0.5, -1.5);  // blanket

  const sign = makeSign(name);
  sign.scale.setScalar(0.52);
  sign.position.set(0, H1 + 0.2, D / 2 + 0.05);     // nameplate over the door
  g.add(sign);

  g.position.set(x, 0, z);
  g.rotation.y = rotationY;
  scene.add(g);
  houses.push({ x, z, ry: rotationY });

  // register the solid ground-floor walls for collision (doorway stays open)
  addWall(x, z, rotationY, -W / 2, -D / 2, W / 2, -D / 2);  // back
  addWall(x, z, rotationY, -W / 2, -D / 2, -W / 2, D / 2);  // left
  addWall(x, z, rotationY, W / 2, -D / 2, W / 2, D / 2);    // right
  addWall(x, z, rotationY, -W / 2, D / 2, -DOOR / 2, D / 2); // front (left of door)
  addWall(x, z, rotationY, DOOR / 2, D / 2, W / 2, D / 2);   // front (right of door)
}

// The floor height under a world point: 0 outside, rising up the stairs to the
// loft (LOFT_Y) inside a house. Single-valued so the player's y is unambiguous.
function houseFloorHeight(wx, wz) {
  for (const h of houses) {
    const [lx, lz] = rotXZ(wx - h.x, wz - h.z, -h.ry);
    if (Math.abs(lx) < HOUSE_W / 2 - 0.15 && lz < HOUSE_D / 2 - 0.15 && lz > -HOUSE_D / 2 + 0.15) {
      if (lz <= STAIR_BACK_Z) return LOFT_Y;                                  // on the loft
      if (lz < STAIR_FRONT_Z) return LOFT_Y * (STAIR_FRONT_Z - lz) / (STAIR_FRONT_Z - STAIR_BACK_Z); // on the stairs
      return 0;                                                              // front, ground level
    }
  }
  return 0;
}

// A flat dirt path strip from (x1,z1) to (x2,z2).
function buildPath(x1, z1, x2, z2, width = 1.7) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.08, len),
    new THREE.MeshStandardMaterial({ color: 0xcdb892, roughness: 1 })
  );
  m.position.set((x1 + x2) / 2, 0.06, (z1 + z2) / 2);
  m.rotation.y = Math.atan2(dx, dz);
  m.receiveShadow = true;
  scene.add(m);
}

const homeById = {};                                   // char id -> home spot (inside its house)
const SLEEPERS = new Set(['kiki', 'bronte', 'spike']); // half go home to sleep at night

function placeHouses(roster) {
  const R = 17;
  const startDeg = 18, endDeg = 180; // southern arc — away from the store (north)
  roster.forEach((c, i) => {
    const tt = roster.length <= 1 ? 0 : i / (roster.length - 1);
    const a = (startDeg + tt * (endDeg - startDeg)) * Math.PI / 180;
    const cs = Math.cos(a), sn = Math.sin(a);
    const col = HOUSE_COLORS[c.id] || { wall: 0xe0d8c8, roof: 0xb08060 };
    buildHouse({
      x: cs * R, z: sn * R,
      rotationY: -(a + Math.PI / 2), // face the doorway toward the center
      name: c.name, wall: col.wall, roof: col.roof,
    });
    homeById[c.id] = { x: cs * (R - 2), z: sn * (R - 2) };       // sleep spot inside the house
    buildPath(cs * 3, sn * 3, cs * (R - 2.5), sn * (R - 2.5));    // path out to this house
  });
  // paths to THE STORE, the DRESSING ROOM, and the HOSPITAL
  buildPath(0, -3, 0, -13);
  buildPath(-2.8, -2.1, DRESS_POS.x, DRESS_POS.z);
  buildPath(2.8, -2.1, 14, -11);
}

// ---------------------------------------------------------------------------
// Day / night cycle: dawn → morning → day → sunset → night → midnight.
// Drives the sun, sky, lights, fog and stars, and flags `isNight` for sleepers.
// ---------------------------------------------------------------------------
const DAY_LENGTH = 200;   // seconds for one full day
const DAY_START = 0.18;   // start mid-morning so it's bright on load
let isNight = false;
const phaseEl = document.getElementById('timephase');

// a starfield that fades in at night
const starGeo = new THREE.BufferGeometry();
const STAR_N = 700;
const starPos = new Float32Array(STAR_N * 3);
for (let i = 0; i < STAR_N; i++) {
  const r = 600, u = (i * 2.3999) % (Math.PI * 2), v = (i / STAR_N);
  const phi = Math.acos(1 - v * 0.9); // upper hemisphere
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(u);
  starPos[i * 3 + 1] = r * Math.cos(phi) + 30;
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(u);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
const starField = new THREE.Points(starGeo, starMat);
scene.add(starField);

const _dayFog = new THREE.Color(0xbfd8ef), _nightFog = new THREE.Color(0x0a1326);
function phaseName(dt) {
  if (dt < 0.05) return ['dawn', '🌅'];
  if (dt < 0.20) return ['morning', '🌄'];
  if (dt < 0.44) return ['day', '☀️'];
  if (dt < 0.52) return ['sunset', '🌇'];
  if (dt < 0.84) return ['night', '🌙'];
  return ['midnight', '🌌'];
}
function updateDayNight(t) {
  const dayT = ((t / DAY_LENGTH) + DAY_START) % 1;
  const sinE = Math.sin(2 * Math.PI * dayT);
  setSun(75 * sinE, 70 + dayT * 220);          // elevation rises & sets; azimuth sweeps
  const dayness = Math.max(0, sinE);           // 0 deep night … 1 high noon
  sunLight.intensity = 0.1 + dayness * 2.5;
  hemi.intensity = 0.2 + dayness * 0.5;
  // keep daytime exposure modest so the sky shows its blue and white sprites
  // (like Boo) don't blow out; night stays a touch brighter for playability.
  renderer.toneMappingExposure = 0.5 + dayness * 0.24;
  scene.fog.color.copy(_nightFog).lerp(_dayFog, dayness);
  starMat.opacity = Math.max(0, 1 - dayness * 3);
  isNight = (75 * sinE) < 3;
  // lamp posts glow & cast light at night
  const lampOn = Math.max(0, 1 - dayness * 2.4);
  for (const lp of lampPosts) {
    lp.light.intensity = lampOn * 1.7;
    lp.orbMat.emissiveIntensity = 0.15 + lampOn * 1.1;
  }
  const [name, icon] = phaseName(dayT);
  if (phaseEl) phaseEl.textContent = icon + ' ' + name;
}

// ---------------------------------------------------------------------------
// A nocturnal owl — only comes out at night, circling slowly overhead.
// ---------------------------------------------------------------------------
let owl = null;
function createOwl() {
  const g = new THREE.Group();
  const brown = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85, side: THREE.DoubleSide });
  const tan = new THREE.MeshStandardMaterial({ color: 0xcda36a, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), brown); body.scale.set(1, 1.2, 1); g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), tan); belly.position.set(0, -0.05, 0.22); belly.scale.set(1, 1.1, 0.6); g.add(belly);
  const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const eyeB = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  for (const sx of [-0.16, 0.16]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), eyeW); e.position.set(sx, 0.18, 0.33); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeB); p.position.set(sx, 0.18, 0.43); g.add(p);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), new THREE.MeshStandardMaterial({ color: 0xf2a93b }));
  beak.position.set(0, 0.05, 0.42); beak.rotation.x = Math.PI / 2; g.add(beak);
  const wingGeo = new THREE.PlaneGeometry(0.55, 0.55);
  const wL = new THREE.Mesh(wingGeo, brown); wL.position.x = -0.45; g.add(wL);
  const wR = new THREE.Mesh(wingGeo, brown); wR.position.x = 0.45; g.add(wR);
  g.userData = { wL, wR };
  g.visible = false;
  scene.add(g);
  owl = g;
}
createOwl();
function updateOwl(t) {
  if (!owl) return;
  owl.visible = isNight;
  if (!isNight) return;
  const ang = -t * 0.16;
  owl.position.set(Math.cos(ang) * 8.5, 7.5 + Math.sin(t * 0.5) * 0.5, Math.sin(ang) * 8.5);
  owl.rotation.y = -ang + Math.PI;
  const flap = Math.sin(t * 5) * 0.5;
  owl.userData.wL.rotation.z = flap;
  owl.userData.wR.rotation.z = -flap;
}

// ---------------------------------------------------------------------------
// Birds that fly in slow circles overhead, flapping their wings.
// ---------------------------------------------------------------------------
const birds = [];
function createBirds() {
  const colors = [0xff7eb6, 0x6aa6ff, 0xffe066, 0xffffff, 0x9b8cff, 0x74e08c];
  for (let i = 0; i < 7; i++) {
    const color = colors[i % colors.length];
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat); body.scale.z = 1.7; g.add(body);
    const wingGeo = new THREE.PlaneGeometry(0.95, 0.42);
    const wL = new THREE.Mesh(wingGeo, mat); wL.position.x = -0.5; g.add(wL);
    const wR = new THREE.Mesh(wingGeo, mat); wR.position.x = 0.5; g.add(wR);
    g.userData = {
      wL, wR,
      radius: 13 + Math.random() * 16,
      height: 10 + Math.random() * 7,
      speed: (0.12 + Math.random() * 0.18) * (Math.random() < 0.5 ? 1 : -1),
      phase: Math.random() * Math.PI * 2,
      flap: 7 + Math.random() * 4,
    };
    scene.add(g);
    birds.push(g);
  }
}
createBirds();
function updateBirds(t) {
  for (const b of birds) {
    const u = b.userData;
    const ang = u.phase + t * u.speed;
    b.position.set(Math.cos(ang) * u.radius, u.height + Math.sin(t * 0.6 + u.phase) * 0.7, Math.sin(ang) * u.radius);
    b.rotation.y = -ang + (u.speed > 0 ? 0 : Math.PI); // face the way it flies
    const flap = Math.sin(t * u.flap + u.phase) * 0.7;
    u.wL.rotation.z = flap;
    u.wR.rotation.z = -flap;
  }
}

// ---- Things you can buy, wear, and (for clothes) recolor ----
const DRESS_ITEMS = [
  // `layer` controls draw order so nothing z-fights: bottoms(1) < tops(2) < accessories(3).
  // accessories — fixed colors, sit on the head/face
  { id: 'crown', name: 'Crown', emoji: '👑', price: 15, y: 1.05, scale: 1.7, recolor: false, layer: 3 },
  { id: 'hat', name: 'Party Hat', emoji: '🎉', price: 6, y: 1.2, scale: 1.7, recolor: false, layer: 3 },
  { id: 'glasses', name: 'Sunglasses', emoji: '🕶️', price: 8, y: 0.35, scale: 1.5, recolor: false, layer: 3 },
  { id: 'bow', name: 'Bow', emoji: '🎀', price: 5, y: 0.9, scale: 1.2, recolor: false, layer: 3 },
  // clothes — white base, recolor them to any color to make your own outfit.
  // Tops cover the torso; bottoms cover the legs; tops draw over bottoms.
  { id: 'tshirt', name: 'T-Shirt', emoji: '👕', price: 7, y: -0.5, scale: 1.4, recolor: true, layer: 2 },
  { id: 'croptop', name: 'Crop Top', emoji: '🎽', price: 7, y: -0.4, scale: 1.2, recolor: true, layer: 2 },
  { id: 'skirt', name: 'Skirt', emoji: '👗', price: 8, y: -0.95, scale: 1.5, recolor: true, layer: 1 },
  { id: 'shorts', name: 'Shorts', emoji: '🩳', price: 6, y: -1.05, scale: 1.4, recolor: true, layer: 1 },
  { id: 'pants', name: 'Pants', emoji: '👖', price: 9, y: -1.05, scale: 1.4, recolor: true, layer: 1 },
  { id: 'rippedpants', name: 'Ripped Pants', emoji: '👖', price: 11, y: -1.05, scale: 1.4, recolor: true, layer: 1 },
];
const PALETTE = [
  0xff7eb6, 0xff5a5a, 0xffa94d, 0xffe066, 0x74e08c,
  0x57d7d7, 0x6aa6ff, 0xb18cff, 0xffffff, 0x4a4f5a,
];
const DEFAULT_CLOTHES_COLOR = 0xff7eb6; // clothes start pink, then recolor

const itemOwned = {}; // id -> true once bought
const itemTex = {};
function getItemTexture(id) {
  if (!itemTex[id]) {
    const t = textureLoader.load(`./assets/accessories/${id}.png`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    itemTex[id] = t;
  }
  return itemTex[id];
}
function wearItem(charMesh, item) {
  if (!charMesh || charMesh.userData.accessories[item.id]) return;
  // white clothes get tinted; accessories keep their own colors
  const color = item.recolor
    ? (charMesh.userData.itemColors[item.id] ?? DEFAULT_CLOTHES_COLOR)
    : 0xffffff;
  const layer = item.layer || 2;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(item.scale, item.scale),
    new THREE.MeshBasicMaterial({
      map: getItemTexture(item.id), transparent: true, alphaTest: 0.3,
      side: THREE.DoubleSide, color,
      depthWrite: false, // don't write depth, so layered clothes never z-fight
    })
  );
  // hug the body (small z), and paint strictly by layer so tops cover bottoms
  m.position.set(0, item.y, 0.02 + layer * 0.01);
  m.renderOrder = 10 + layer;
  charMesh.add(m);
  charMesh.userData.accessories[item.id] = m;
  if (item.recolor) charMesh.userData.itemColors[item.id] = color;
}
function takeOffItem(charMesh, item) {
  const m = charMesh && charMesh.userData.accessories[item.id];
  if (m) { charMesh.remove(m); delete charMesh.userData.accessories[item.id]; }
}
function recolorItem(charMesh, item, hex) {
  charMesh.userData.itemColors[item.id] = hex;
  const m = charMesh.userData.accessories[item.id];
  if (m) m.material.color.set(hex);
}
const isWearing = (charMesh, id) => !!(charMesh && charMesh.userData.accessories[id]);

// ---- Dressing-room UI ----
let dressEl = null, dressOpen = false, dressListEl = null, dressMsgEl = null;
function buildDress() {
  dressEl = document.createElement('div');
  dressEl.id = 'dressroom';
  dressEl.style.display = 'none';
  const h = document.createElement('h3');
  h.append('👗 DRESSING ROOM');
  const sub = document.createElement('p');
  sub.className = 'shop-sub';
  sub.textContent = 'Buy, wear & recolor — make your own outfit!';
  dressListEl = document.createElement('div');
  dressListEl.className = 'shop-list';
  dressMsgEl = document.createElement('p');
  dressMsgEl.className = 'shop-msg';
  dressEl.append(h, sub, dressListEl, dressMsgEl);
  document.body.appendChild(dressEl);
}
function refreshDress() {
  if (!dressListEl) return;
  const mesh = player && player.userData.mesh;
  dressListEl.replaceChildren();
  DRESS_ITEMS.forEach((item) => {
    const entry = document.createElement('div');
    entry.className = 'dress-entry';
    const row = document.createElement('button');
    row.className = 'shop-item';
    const lbl = document.createElement('span');
    lbl.textContent = `${item.emoji} ${item.name}`;
    const action = document.createElement('span');
    action.className = 'shop-price';
    if (!itemOwned[item.id]) {
      action.textContent = `Buy ${item.price} ⭐`;
      row.addEventListener('click', () => buyDressItem(item));
    } else if (isWearing(mesh, item.id)) {
      action.textContent = 'Take off';
      row.classList.add('worn');
      row.addEventListener('click', () => { takeOffItem(mesh, item); refreshDress(); });
    } else {
      action.textContent = 'Wear';
      row.addEventListener('click', () => { wearItem(mesh, item); refreshDress(); });
    }
    row.append(lbl, action);
    entry.appendChild(row);

    // color swatches for clothes you're currently wearing
    if (item.recolor && isWearing(mesh, item.id)) {
      const sw = document.createElement('div');
      sw.className = 'swatches';
      const current = mesh.userData.itemColors[item.id];
      PALETTE.forEach((hex) => {
        const dot = document.createElement('button');
        dot.className = 'swatch' + (current === hex ? ' sel' : '');
        dot.style.background = '#' + hex.toString(16).padStart(6, '0');
        dot.addEventListener('click', () => { recolorItem(mesh, item, hex); refreshDress(); });
        sw.appendChild(dot);
      });
      entry.appendChild(sw);
    }
    dressListEl.appendChild(entry);
  });
}
function buyDressItem(item) {
  if (score < item.price) {
    dressMsgEl.textContent = `Not enough — you need ${item.price} ⭐!`;
    animate(dressMsgEl, { opacity: [0.3, 1], duration: 220 });
    return;
  }
  score -= item.price;
  renderScore();
  animate(scoreEl, { scale: [1.3, 1], duration: 300, ease: 'out(3)' });
  itemOwned[item.id] = true;
  wearItem(player && player.userData.mesh, item); // put it on right away
  dressMsgEl.textContent = `You got the ${item.emoji} ${item.name}!`;
  animate(dressMsgEl, { scale: [1.2, 1], opacity: [0.4, 1], duration: 300, ease: 'out(3)' });
  refreshDress();
}
function openDress() { dressOpen = true; refreshDress(); dressEl.style.display = 'block'; animate(dressEl, { opacity: [0, 1], duration: 240, ease: 'out(3)' }); }
function closeDress() { dressOpen = false; animate(dressEl, { opacity: [1, 0], duration: 200, onComplete: () => { dressEl.style.display = 'none'; } }); }
buildDress();

function updateDress() {
  let near = false;
  if (player) {
    const dx = player.position.x - DRESS_POS.x;
    const dz = player.position.z - DRESS_POS.z;
    near = (dx * dx + dz * dz) < 5.5 * 5.5;
  }
  if (near && !dressOpen) openDress();
  else if (!near && dressOpen) closeDress();
}

// ---------------------------------------------------------------------------
// Post-processing — subtle bloom for that "production" glow
// ---------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.18, // strength — subtle, so the sky and white sprites don't blow out
  0.5,  // radius
  0.96  // threshold — only very bright (emissive) pixels glow
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

// On-screen joystick for touch devices (drives the same movement as the keys).
// joyVec.x = right/left (-1..1), joyVec.y = down/up (-1..1, up = forward).
const joyVec = { x: 0, y: 0, active: false };
(function setupJoystick() {
  const el = document.getElementById('joystick');
  const knob = document.getElementById('joyknob');
  if (!el || !knob) return;
  // show the joystick on touch / coarse-pointer devices
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches
      || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch');
  }
  const R = 48; // max knob travel in px
  let id = null;
  function moveKnob(e) {
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(len, R) / len;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joyVec.x = dx / R; joyVec.y = dy / R;
  }
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); id = e.pointerId;
    try { el.setPointerCapture(id); } catch (err) { /* ignore */ }
    joyVec.active = true; moveKnob(e);
  });
  el.addEventListener('pointermove', (e) => { if (joyVec.active && e.pointerId === id) moveKnob(e); });
  const release = (e) => {
    if (e && e.pointerId !== id) return;
    joyVec.active = false; joyVec.x = 0; joyVec.y = 0; id = null;
    knob.style.transform = 'translate(0px, 0px)';
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
})();

function updateMovement(dt) {
  if (keys.size === 0 && !joyVec.active) return;

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
  if (joyVec.active) { _move.addScaledVector(_forward, -joyVec.y); _move.addScaledVector(_right, joyVec.x); }
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

  updateDayNight(t);
  updateBirds(t);
  updateOwl(t);
  updateCampfire(t);
  updateAmbulance(t);

  // Move first (player walks / free camera), then update characters' facing & bob.
  if (player) updatePlayer(dt); else updateMovement(dt);

  updateCollectibles(t, dt);
  updateShop();
  updateDress();

  // Characters: wander around, face the camera (upright billboard), and bob/hop.
  for (const b of billboards) {
    const holder = b.parent;
    const w = holder.userData;

    // roam toward the current target, then pause and pick a new one.
    // The player-controlled character (and the shopkeeper) skip roaming.
    // updatePlayer() sets the player's position/moving flag instead.
    if (!w.isPlayer && !w.isShopkeeper) {
      w.sleeping = false;
      const cid = b.userData.char && b.userData.char.id;
      if (isNight && SLEEPERS.has(cid) && homeById[cid]) {
        // at night, half the characters head home to sleep
        const home = homeById[cid];
        _charDir.set(home.x - holder.position.x, 0, home.z - holder.position.z);
        const d = _charDir.length();
        if (d < 0.4) { w.moving = false; w.sleeping = true; } // tucked in at home
        else { w.moving = true; const step = Math.min(w.speed * dt, d); holder.position.x += (_charDir.x / d) * step; holder.position.z += (_charDir.z / d) * step; }
      } else if (t >= w.pauseUntil) {
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

    // show a floating 💤 while sleeping
    if (holder.userData.zzz) {
      holder.userData.zzz.visible = !!w.sleeping;
      if (w.sleeping) holder.userData.zzz.position.y = (CHAR_HEIGHT + 1.0) + Math.sin(t * 2 + b.userData.bobPhase) * 0.12;
    }
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
window.SANDYTEN = { THREE, scene, camera, renderer, controls, composer, crystals, setSun, animate, utils, wallSegments, resolveWalls, houses, houseFloorHeight };
