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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // adaptive quality may lower this
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.info.autoReset = false;           // we reset once per frame so info covers all passes
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

// Dim ONLY the sky by 50% (multiply its color before tone-mapping) so the sky
// is calmer without darkening the ground or characters.
sky.material.fragmentShader = sky.material.fragmentShader.replace(
  'gl_FragColor = vec4( texColor, 1.0 );',
  'gl_FragColor = vec4( texColor * 0.5, 1.0 );'
);
sky.material.needsUpdate = true;

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
sunLight.shadow.mapSize.set(1024, 1024); // 2048 was 4x the shadow fill for little visible gain
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

// Trees are scattered AFTER the buildings exist, avoiding building footprints.
const noTreeZones = []; // {x, z, r} areas to keep clear of trees
const TREE_FILES = ['tree.glb', 'tree-high-round.glb', 'tree-crooked.glb'];
function scatterTrees() {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let placed = 0, tries = 0;
  while (placed < 30 && tries < 500) {
    tries++;
    const a = rnd() * Math.PI * 2, r = 13 + rnd() * 22;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    let blocked = false;
    for (const zn of noTreeZones) { if (Math.hypot(x - zn.x, z - zn.z) < zn.r) { blocked = true; break; } }
    if (blocked) continue;
    loadModel(TREE_FILES[placed % TREE_FILES.length], { position: [x, 0, z], rotationY: rnd() * 6, scale: 1.8 + rnd() * 1.0 });
    placed++;
  }
}

// Lamp posts around the courtyard that light up at night.
// Lamp posts. Each one's orb GLOWS for free (emissive), but instead of giving
// every lamp its own PointLight (20+ point lights = a huge forward-rendering
// cost, paid per-fragment even when off), we share a small pool of point lights
// that hop to whichever lamps are nearest the camera. ~6 lights light 20 lamps.
const lampPosts = [];
const POLE_GEO = new THREE.CylinderGeometry(0.08, 0.12, 2.8, 8);
const POLE_MAT = new THREE.MeshStandardMaterial({ color: 0x46484f, roughness: 0.7 });
function makeLampPost(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(POLE_GEO, POLE_MAT);
  pole.position.y = 1.4; g.add(pole); // poles don't cast shadows (cheap, barely visible)
  const orbMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd97a, emissiveIntensity: 0.15, roughness: 0.4 });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), orbMat);
  orb.position.y = 2.95; g.add(orb);
  g.position.set(x, 0, z); scene.add(g);
  lampPosts.push({ x, z, orbMat });
}
const LAMP_POOL_SIZE = 8;
const lampLightPool = [];
for (let i = 0; i < LAMP_POOL_SIZE; i++) { const l = new THREE.PointLight(0xffe0a0, 0, 20, 1.7); scene.add(l); lampLightPool.push(l); }
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.4;
  makeLampPost(Math.cos(a) * 9.5, Math.sin(a) * 9.5);
}
// a wider ring of lamps to light up more of the city
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + 0.2;
  makeLampPost(Math.cos(a) * 19, Math.sin(a) * 19);
}
// lamps along the path out to the park
makeLampPost(-12, -2); makeLampPost(-21, -6);

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
  const w = holder.userData;
  // wanderers drift between the city, the park, the neighborhood, the campsite & the pond
  if (w.wander && Math.random() < 0.3) {
    const zones = [{ x: 0, z: 0, r: 11 }, { x: PARK.x, z: PARK.z, r: 15 }, { x: 0, z: 24, r: 11 }, { x: CAMP.x, z: CAMP.z, r: 11 }, { x: POND.x, z: POND.z, r: 5 }];
    const zn = zones[Math.floor(Math.random() * zones.length)];
    w.roamCenter = zn; w.roamRadius = zn.r; w.roamInner = 1;
  }
  const cx = w.roamCenter ? w.roamCenter.x : 0;
  const cz = w.roamCenter ? w.roamCenter.z : 0;
  const inner = w.roamInner != null ? w.roamInner : ROAM_INNER;
  const outer = w.roamRadius != null ? w.roamRadius : ROAM_OUTER;
  // courtyard roamers sometimes go for the nearest star (NPCs collect too)
  if (!w.roamCenter && Math.random() < 0.5 && typeof collectibles !== 'undefined' && collectibles.children.length) {
    let best = null, bestD = Infinity;
    for (const s of collectibles.children) {
      if (s.userData.collected) continue;
      const d = (s.position.x - holder.position.x) ** 2 + (s.position.z - holder.position.z) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best) { w.target.set(best.position.x, 0, best.position.z); return; }
  }
  const a = Math.random() * Math.PI * 2;
  const r = inner + Math.random() * (outer - inner);
  w.target.set(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
}

// When a kid/pet/cat is near its play area, it runs between the activities and
// plays on each one (the slide triggers an actual slide-down). Returns true
// while the entity is busy playing, so the normal roam/trail logic is skipped.
function playAtStations(holder, w, t, dt) {
  if (!w.playArea) return false;
  const center = w.playArea === 'playground' ? PLAYGROUND : PETPARK;
  const stations = w.playArea === 'playground' ? PLAY_STATIONS : PET_STATIONS;
  if (!stations || !stations.length) return false;
  if (Math.hypot(holder.position.x - center.x, holder.position.z - center.z) > 11) { w.station = null; w.stationArrive = 0; return false; }
  if (!w.station || (!w.stationArrive && t > w.stationGiveUp)) { // (re)pick, giving up on any spot we can't reach
    w.station = stations[Math.floor(Math.random() * stations.length)]; w.stationArrive = 0; w.stationGiveUp = t + 5;
  }
  const st = w.station;
  const dx = st.x - holder.position.x, dz = st.z - holder.position.z, d = Math.hypot(dx, dz);
  if (w.stationArrive) { // playing at the station
    w.moving = false; w.playing = true;
    if (t > w.stationArrive) { w.station = null; w.stationArrive = 0; } // move on to the next activity
    return true;
  }
  if (st.slide && d < 1.2 && (!w.slideCooldown || t > w.slideCooldown)) { // wheee, slide down!
    holder.position.set(SLIDE_TOP.x, SLIDE_TOP.y, SLIDE_TOP.z);
    w.sliding = { t0: t, dur: 1.1, from: SLIDE_TOP.clone() };
    w.station = null; w.stationArrive = 0; return true;
  }
  if (d > 0.6) { w.moving = true; const step = Math.min(w.speed * 1.5 * dt, d); holder.position.x += dx / d * step; holder.position.z += dz / d * step; }
  else { w.stationArrive = t + 1.8 + Math.random() * 2.2; w.moving = false; w.playing = true; } // arrived → play
  return true;
}

// Characters carry a "good" they're trading, and swap when two of them meet.
const TRADE_GOODS = ['🍎', '🍞', '🧀', '🥕', '🐟', '🌸', '⭐', '🎁', '🍇', '🥚', '🍪', '🌽', '🍓', '🥨', '🧁'];
const randomGood = () => TRADE_GOODS[Math.floor(Math.random() * TRADE_GOODS.length)];
let nextTradeAt = 5;
function updateTrades(t) {
  if (t < nextTradeAt) return;
  nextTradeAt = t + 2.5 + Math.random() * 3;
  const avail = [];
  for (const b of billboards) {
    const w = b.parent.userData;
    if (w.isPlayer || w.isShopkeeper || w.sleeping || w.child || w.isCritter) continue;
    if (w.tradeUntil && t < w.tradeUntil) continue;
    avail.push(b.parent);
  }
  for (let i = 0; i < avail.length; i++) {
    for (let j = i + 1; j < avail.length; j++) {
      const a = avail[i], c = avail[j];
      if (Math.hypot(a.position.x - c.position.x, a.position.z - c.position.z) < 3.6) {
        // swap their goods, pause, and show what each gave away
        const ga = a.userData.tradeGood || randomGood();
        const gc = c.userData.tradeGood || randomGood();
        a.userData.tradeGood = gc; c.userData.tradeGood = ga;
        const until = t + 3;
        a.userData.tradeUntil = until; c.userData.tradeUntil = until;
        setEmoji(a.userData.tradeSprite, gc);
        setEmoji(c.userData.tradeSprite, ga);
        if (tradeOpen) refreshTradePanel();
        return;
      }
    }
  }
}

// ---- Trading list: see what everyone is trading, and trade with them ----
let tradeEl = null, tradeOpen = false, tradeListEl = null, tradeMsgEl = null;
function buildTradePanel() {
  tradeEl = document.createElement('div');
  tradeEl.id = 'tradepanel';
  tradeEl.style.display = 'none';
  const h = document.createElement('h3'); h.append('🤝 Trading');
  const sub = document.createElement('p'); sub.className = 'shop-sub';
  sub.textContent = "Everyone's goods — tap Trade to get one!";
  tradeListEl = document.createElement('div'); tradeListEl.className = 'shop-list';
  tradeMsgEl = document.createElement('p'); tradeMsgEl.className = 'shop-msg';
  tradeEl.append(h, sub, tradeListEl, tradeMsgEl);
  document.body.appendChild(tradeEl);
}
function refreshTradePanel() {
  if (!tradeListEl) return;
  tradeListEl.replaceChildren();
  const seen = new Set();
  for (const b of billboards) {
    const ch = b.userData.char;
    if (!ch || seen.has(ch.id) || b.parent.userData.child || b.parent.userData.isCritter) continue;
    seen.add(ch.id);
    const holder = b.parent;
    const row = document.createElement('div'); row.className = 'shop-item';
    const lbl = document.createElement('span');
    lbl.textContent = `${ch.name}  ${holder.userData.tradeGood || ''}`;
    row.appendChild(lbl);
    if (holder === player) {
      const tag = document.createElement('span'); tag.className = 'shop-price'; tag.textContent = '(you)';
      row.appendChild(tag);
    } else {
      const btn = document.createElement('button'); btn.className = 'shop-price'; btn.style.cursor = 'pointer';
      btn.textContent = 'Trade';
      btn.addEventListener('click', () => playerTradeWith(holder));
      row.appendChild(btn);
    }
    tradeListEl.appendChild(row);
  }
}
function playerTradeWith(holder) {
  const good = holder.userData.tradeGood || randomGood();
  holder.userData.tradeGood = randomGood();          // they restock with a new good
  addCoins(1);                                        // trading earns coins
  if (typeof onTrade === 'function') onTrade();        // quest progress
  const nm = holder.userData.mesh?.userData.char?.name || 'them';
  tradeMsgEl.textContent = `Traded with ${nm}: got ${good}! +1 🪙`;
  animate(tradeMsgEl, { scale: [1.2, 1], opacity: [0.4, 1], duration: 300, ease: 'out(3)' });
  refreshTradePanel();
  if (typeof saveGame === 'function') saveGame();
}
function openTrade() { if (typeof questOpen !== 'undefined' && questOpen) closeQuests(); tradeOpen = true; refreshTradePanel(); tradeEl.style.display = 'block'; animate(tradeEl, { opacity: [0, 1], duration: 240, ease: 'out(3)' }); }
function closeTrade() { tradeOpen = false; animate(tradeEl, { opacity: [1, 0], duration: 200, onComplete: () => { tradeEl.style.display = 'none'; } }); }
buildTradePanel();

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

// A small sprite showing an emoji (used for "trading" goods above characters).
function setEmoji(sprite, emoji) {
  const { ctx, tex } = sprite.userData;
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = '84px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  tex.needsUpdate = true;
}
function makeEmojiSprite(emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.9, 0.9, 1);
  s.visible = false;
  s.userData = { canvas, ctx, tex };
  setEmoji(s, emoji);
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
    wander: true, // stroll between the city, park and neighborhood
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

  const tradeSprite = makeEmojiSprite('🎁');
  tradeSprite.position.set(-0.95, CHAR_HEIGHT + 0.35, 0);
  holder.add(tradeSprite);
  holder.userData.tradeSprite = tradeSprite;
  holder.userData.tradeGood = randomGood(); // the item this character is trading

  const umbrella = makeEmojiSprite('☂️'); // shown when it rains
  umbrella.position.set(0, CHAR_HEIGHT * 0.95, 0.06);
  umbrella.scale.set(1.6, 1.6, 1);
  holder.add(umbrella);
  holder.userData.umbrella = umbrella;

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
    buildNeighborhood(); // extra families + a park behind the houses
    buildForest();       // a little forest where the quest animals live
    buildForestAnimals();// foxes, deer, squirrels & hedgehogs roaming the forest
    buildGarden();       // a plot you can plant & grow
    spawnEnemies();      // monsters you can choose to battle
    scatterTrees();      // trees everywhere except on the buildings & park
    // expose the roster + their stats for the game the girls build next
    window.SANDYTEN.roster = roster;
    buildPicker(roster);
    buildStartMenu();
    setTimeout(showStartMenu, 1400); // New Game / Continue first

  })
  .catch((err) => console.warn('Could not load characters.json', err));

// ---------------------------------------------------------------------------
// Choose-your-character + play as them (walk around, camera follows).
// ---------------------------------------------------------------------------
const PLAYER_SPEED = 7;     // how fast you walk as your character
const PLAY_RADIUS = 58;     // how far you can wander (out to the bigger park & neighborhood)
let pickerEl = null;
let playerCharId = null;
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
  const addCard = (id, name, sprite) => {
    const card = document.createElement('button');
    card.className = 'picker-card';
    const img = document.createElement('img');
    img.src = `./assets/characters/${sprite}`;
    img.alt = name;
    const nm = document.createElement('span');
    nm.textContent = name;
    card.append(img, nm);
    card.addEventListener('click', () => {
      if (performance.now() < pickerReadyAt) return; // ignore clicks during fade-in
      playAs(id); hidePicker();
    });
    grid.appendChild(card);
  };
  roster.forEach((c) => addCard(c.id, c.name, c.sprite));
  if (typeof NEIGHBORS !== 'undefined') NEIGHBORS.forEach((n) => addCard(n.id, n.name, n.sprite)); // neighbors
  if (typeof NEIGHBORS2 !== 'undefined') NEIGHBORS2.forEach((n) => addCard(n.id, n.name, n.sprite)); // new families
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

// ---- Save / load progress (localStorage) ----
const SAVE_KEY = 'sandyten_save_v1';
let suppressSave = false;
function saveGame() {
  if (suppressSave) return;
  try {
    const outfits = {};
    for (const id in holdersById) {
      const mesh = holdersById[id].userData.mesh;
      if (!mesh) continue;
      const worn = Object.keys(mesh.userData.accessories || {});
      if (worn.length || Object.keys(mesh.userData.itemColors || {}).length) {
        outfits[id] = { worn, colors: { ...mesh.userData.itemColors } };
      }
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify({ coins, level, levelStars, starBalance, battleWins, prizes, bagCount, bagValue, itemOwned, owned, playerId: playerCharId, outfits, questState: (typeof getQuestSave === 'function' ? getQuestSave() : null) }));
  } catch (e) { /* storage unavailable */ }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
function loadGame() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  if (!s) return null;
  suppressSave = true;
  coins = s.coins ?? coins; level = s.level ?? 1; levelStars = s.levelStars ?? 0;
  starBalance = s.starBalance ?? 0; battleWins = s.battleWins ?? 0;
  Object.keys(prizes).forEach((k) => delete prizes[k]); Object.assign(prizes, s.prizes || {});
  if (typeof applyPrizeEffects === 'function') applyPrizeEffects();
  if (typeof refreshPrizes === 'function') refreshPrizes();
  bagCount = s.bagCount ?? 0; bagValue = s.bagValue ?? 0; if (typeof refreshSell === 'function') refreshSell();
  if (typeof setQuestSave === 'function' && s.questState) setQuestSave(s.questState);
  Object.assign(itemOwned, s.itemOwned || {});
  Object.assign(owned, s.owned || {});
  renderCoins(); renderLevel();
  for (const id in (s.outfits || {})) {
    const holder = holdersById[id]; if (!holder || !holder.userData.mesh) continue;
    const mesh = holder.userData.mesh, o = s.outfits[id];
    Object.assign(mesh.userData.itemColors, o.colors || {});
    for (const itemId of (o.worn || [])) {
      const item = DRESS_ITEMS.find((it) => it.id === itemId);
      if (item) wearItem(mesh, item);
    }
  }
  suppressSave = false;
  return s;
}

// ---- Start menu: New Game / Continue Game ----
let startEl = null, startReadyAt = 0;
function buildStartMenu() {
  startEl = document.createElement('div');
  startEl.id = 'startmenu';
  const panel = document.createElement('div');
  panel.className = 'start-panel';
  const h = document.createElement('h1'); h.textContent = 'Sandyten';
  const sub = document.createElement('p'); sub.textContent = 'A little world to explore 🌳🐶';
  const newBtn = document.createElement('button'); newBtn.className = 'start-btn'; newBtn.textContent = '✨ New Game';
  const contBtn = document.createElement('button'); contBtn.className = 'start-btn'; contBtn.textContent = '▶️ Continue Game';
  if (!hasSave()) { contBtn.disabled = true; contBtn.classList.add('disabled'); }
  newBtn.addEventListener('click', () => {
    if (performance.now() < startReadyAt) return;
    clearSave();
    coins = 20; level = 1; levelStars = 0; bagCount = 0; bagValue = 0;
    starBalance = 0; battleWins = 0; Object.keys(prizes).forEach((k) => delete prizes[k]); applyPrizeEffects();
    renderCoins(); renderLevel();
    if (typeof refreshSell === 'function') refreshSell();
    if (typeof refreshPrizes === 'function') refreshPrizes();
    if (typeof resetQuests === 'function') resetQuests();
    hideStartMenu(); showPicker();
  });
  contBtn.addEventListener('click', () => {
    if (contBtn.disabled || performance.now() < startReadyAt) return;
    const s = loadGame();
    hideStartMenu();
    if (s && s.playerId && holdersById[s.playerId]) playAs(s.playerId);
    else showPicker();
  });
  panel.append(h, sub, newBtn, contBtn);
  startEl.appendChild(panel);
  document.body.appendChild(startEl);
}
function showStartMenu() { if (startEl) { startEl.style.display = 'flex'; startReadyAt = performance.now() + 500; animate(startEl, { opacity: [0, 1], duration: 280, ease: 'out(3)' }); } }
function hideStartMenu() { if (startEl) animate(startEl, { opacity: [1, 0], duration: 220, onComplete: () => { startEl.style.display = 'none'; } }); }

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
  playerCharId = id;
  holder.position.y = 0;            // start on the ground
  holder.userData.isPlayer = true;
  holder.userData.moving = false;
  holder.userData.pauseUntil = Infinity; // never roam while controlled

  // frame the player with a zoomed-out third-person camera
  const p = holder.position;
  controls.target.set(p.x, 1.5, p.z);
  camera.position.set(p.x + 11, 9, p.z + 15);
  controls.minDistance = 4;
  controls.maxDistance = 40;
  controls.update();

  const name = holder.children.find((c) => c.userData?.char)?.userData.char.name
    || (window.SANDYTEN.roster.find((r) => r.id === id) || {}).name || 'your character';
  const strong = document.createElement('strong');
  strong.textContent = name;
  const move = document.body.classList.contains('touch') ? 'joystick to move · drag to look' : 'arrow keys / WASD to move · drag to look';
  hintEl.replaceChildren('Playing as ', strong, ' — ' + move);
  changeBtn.style.display = '';

  // move Daisy's doghouse next to this character's home
  const spot = (typeof doghouseSpotById !== 'undefined') && doghouseSpotById[id];
  if (spot) doghouseTarget.set(spot.x, 0, spot.z);
  if (typeof saveGame === 'function') saveGame();
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

  _move.normalize().multiplyScalar(PLAYER_SPEED * prizeSpeed * dt); // Speed Boots prize makes you faster
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

function showBubble(mesh, name, text, offsetY) {
  bubbleWho.textContent = name;            // safe: no HTML injection
  bubbleText.textContent = text;
  bubbleEl.style.display = 'block';
  activeBubble = { mesh, hideAt: timer.getElapsed() + 3.4, offsetY };
  positionBubble(mesh);                    // place it before fading in
  animate(bubbleEl, { opacity: [0, 1], duration: 260, ease: 'out(3)' });
}

function showSpeech(mesh) {
  const char = mesh.userData.char;
  if (!char) return;
  const lines = (char.lines && char.lines.length) ? char.lines : ['Hi!'];
  showBubble(mesh, char.name, lines[Math.floor(Math.random() * lines.length)], CHAR_HEIGHT * 0.5);
}

function positionBubble(mesh) {
  mesh.getWorldPosition(_headPos);
  _headPos.y += (activeBubble ? activeBubble.offsetY : CHAR_HEIGHT * 0.5); // float above
  _headPos.project(camera);
  if (_headPos.z > 1) { bubbleEl.style.display = 'none'; return; } // behind camera
  bubbleEl.style.left = ((_headPos.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  bubbleEl.style.top = ((-_headPos.y * 0.5 + 0.5) * window.innerHeight) + 'px';
}

// Tap detection: only count it as a click if the pointer barely moved
// (so dragging to look around doesn't trigger a speech bubble).
let downX = 0, downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
function clickTargets() {
  let list = petDog ? billboards.concat(petDog.mesh) : billboards;
  if (gardenSpots.length) list = list.concat(gardenSpots.map((r) => r.mound));
  if (pondSurface) list = list.concat(pondSurface);
  return list;
}
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(clickTargets(), false);
  if (!hits.length) return;
  const obj = hits[0].object;
  if (obj.userData.isPond) {                  // tapped the pond → go fishing
    startFishing();
  } else if (obj.userData.isGarden) {         // tapped a garden plot → plant/harvest
    handleGardenClick(obj);
  } else if (petDog && obj === petDog.mesh) { // clicked the puppy → bark!
    playWoof();
    showBubble(petDog.mesh, DOG_NAME, 'Woof! 🐶', 1.3);
    petDog.barkUntil = timer.getElapsed() + 0.4; // little excited hop
    if (typeof onPetDog === 'function') onPetDog(); // quest progress
  } else {
    showSpeech(obj);
  }
});

// Show a pointer cursor when hovering a character or the puppy.
renderer.domElement.addEventListener('pointermove', (e) => {
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  renderer.domElement.style.cursor = raycaster.intersectObjects(clickTargets(), false).length ? 'pointer' : '';
});

// ---------------------------------------------------------------------------
// Collectible stars — walk into one (as your character) to collect it.
// Each pop plays a chime, bumps the counter, and a fresh star appears.
// ---------------------------------------------------------------------------
// Collectible coins scattered around the world (money you pick up).
const COIN_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.13, 22);
COIN_GEO.rotateX(Math.PI / 2); // disc faces forward so it reads as a spinning coin
const COIN_MAT = new THREE.MeshStandardMaterial({
  color: 0xffd54a, emissive: 0xffb300, emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.6,
});
const STAR_COUNT = 16;
const STAR_Y = 1.2;

const collectibles = new THREE.Group();
scene.add(collectibles);

function spawnStar() {
  const m = new THREE.Mesh(COIN_GEO, COIN_MAT);
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

// Coins = money (collected in the world, spent at the shop / dressing room).
// Stars = experience from quests; each level needs more (5, 10, 15, 20, …).
let coins = 20, level = 1, levelStars = 0;
let starBalance = 0;   // stars you've earned and can spend on prizes (separate from your level)
let battlePower = 0;   // bonus strength from prizes & won battles
const prizes = {};     // owned special prizes -> true
// the player gets stronger as they level up (and from the Power prize / winning battles)
let battleWins = 0;
function playerAtk() { return 8 + level * 2 + battlePower; }
function playerMaxHp() { return 30 + level * 6 + battlePower * 3; }
// special-prize effects the player can buy with stars
let prizeSpeed = 1, prizeMagnet = false, prizeLucky = false, prizeLantern = false;
function applyPrizeEffects() {
  prizeSpeed = prizes.speed ? 1.4 : 1;
  prizeMagnet = !!prizes.magnet; prizeLucky = !!prizes.lucky; prizeLantern = !!prizes.lantern;
  battlePower = battleWins + (prizes.power ? 6 : 0);
}
let bagCount = 0, bagValue = 0; // crops & fish you've gathered, waiting to be sold at THE STORE
function addProduce(value) { bagCount += 1; bagValue += value; if (typeof refreshSell === 'function') refreshSell(); }
function sellProduce() {
  if (bagCount <= 0) return 0;
  const c = prizeLucky ? bagValue * 2 : bagValue, s = Math.max(1, Math.floor(bagCount / 2)); // coins + stars (helps you level up!)
  addCoins(c); addStars(s);
  bagCount = 0; bagValue = 0;
  if (typeof refreshSell === 'function') refreshSell();
  if (typeof saveGame === 'function') saveGame();
  return c;
}
const coinsEl = document.getElementById('coins');
const levelEl = document.getElementById('level');
const starsToNext = () => level * 5; // +5 every level
function renderCoins() { if (coinsEl) coinsEl.textContent = '🪙 ' + coins; }
function renderLevel() { if (levelEl) levelEl.textContent = '✨ Lv ' + level + ' (' + levelStars + '/' + starsToNext() + ')'; }
function addStars(n) { // earn quest stars; level up when you fill the bar
  starBalance += n; // also bank them to spend on prizes
  for (let k = 0; k < n; k++) {
    levelStars += 1;
    if (levelStars >= starsToNext()) { levelStars -= starsToNext(); level += 1; playDing(); }
  }
  renderLevel();
  if (typeof refreshPrizes === 'function') refreshPrizes();
  if (levelEl) animate(levelEl, { scale: [1.4, 1], duration: 320, ease: 'out(3)' });
  if (typeof saveGame === 'function') saveGame();
}
function addCoins(n) {
  coins += n;
  renderCoins();
  if (coinsEl) animate(coinsEl, { scale: [1.3, 1], duration: 300, ease: 'out(3)' });
}
renderCoins();
renderLevel();

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

// a cute "woof woof" for the puppy
function playWoof() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    for (const start of [0, 0.18]) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(440, now + start);
      o.frequency.exponentialRampToValueAtTime(230, now + start + 0.13);
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(0.16, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.15);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + start);
      o.stop(now + start + 0.16);
    }
  } catch (e) { /* no audio — no problem */ }
}
function playSplash() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, now); o.frequency.exponentialRampToValueAtTime(280, now + 0.13);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.09, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g).connect(audioCtx.destination); o.start(now); o.stop(now + 0.17);
  } catch (e) { /* no audio */ }
}

// ---- Happy party music: several different tunes you can cycle through ----
let musicOn = false, musicGain = null, musicTimer = null, musicStep = 0, nextNoteTime = 0, musicTrack = 0;
// each track: name, BPM, lead wave, melody (semitones from C5) and bass (from C3)
const MUSIC_TRACKS = [
  { name: 'Party Pop', bpm: 126, lead: 'triangle',
    melody: [0, 4, 7, 12, 7, 4, 5, 9, 0, 4, 7, 12, 9, 7, 4, 2],
    bass:   [0, 7, 5, 7, 0, 7, 9, 5] },
  { name: 'Bouncy', bpm: 138, lead: 'square',
    melody: [0, 0, 7, 7, 9, 9, 7, 5, 4, 4, 2, 2, 0, 4, 7, 4],
    bass:   [0, 0, 5, 5, 7, 7, 0, 0] },
  { name: 'Skippy', bpm: 150, lead: 'triangle',
    melody: [12, 11, 9, 7, 9, 11, 12, 14, 16, 14, 12, 11, 9, 7, 5, 7],
    bass:   [0, 4, 5, 7, 9, 7, 5, 4] },
  { name: 'Dreamy', bpm: 108, lead: 'sine',
    melody: [7, 9, 11, 12, 11, 9, 7, 4, 5, 7, 9, 7, 4, 2, 0, 4],
    bass:   [0, 0, 9, 9, 5, 5, 7, 7] },
];
const musFreq = (semi, base) => base * Math.pow(2, semi / 12);
function musTone(freq, time, dur, type, gain) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(g).connect(musicGain);
  o.start(time); o.stop(time + dur + 0.03);
}
function scheduleMusic() {
  if (!musicOn) return;
  const tr = MUSIC_TRACKS[musicTrack];
  const eighth = (60 / tr.bpm) / 2;
  while (nextNoteTime < audioCtx.currentTime + 0.25) {
    const i = musicStep % 16;
    musTone(musFreq(tr.melody[i], 523.25), nextNoteTime, eighth * 0.9, tr.lead, 0.12); // lead
    if (i % 2 === 0) musTone(musFreq(tr.bass[(i / 2) % 8], 130.81), nextNoteTime, eighth * 1.7, 'sine', 0.16); // bass
    nextNoteTime += eighth; musicStep++;
  }
  musicTimer = setTimeout(scheduleMusic, 60);
}
function startTrack() {
  musicStep = 0; nextNoteTime = audioCtx.currentTime + 0.06; scheduleMusic();
}
// cycle: off -> track 0 -> track 1 -> ... -> off. Returns the current track name or null.
function cycleMusic() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (!musicGain) { musicGain = audioCtx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(audioCtx.destination); }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    clearTimeout(musicTimer);
    if (!musicOn) { musicOn = true; musicTrack = 0; startTrack(); return MUSIC_TRACKS[0].name; }
    musicTrack += 1;
    if (musicTrack >= MUSIC_TRACKS.length) { musicOn = false; return null; } // turn off after the last
    startTrack();
    return MUSIC_TRACKS[musicTrack].name;
  } catch (e) { return null; }
}

function collectStar(s, byPlayer) {
  s.userData.collected = true;
  if (byPlayer) { playDing(); addCoins(1); if (typeof onCoinCollected === 'function') onCoinCollected(); } // coins = money
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
      const d2 = dx * dx + dz * dz;
      if (prizeMagnet && d2 < 49 && d2 > COLLECT_DIST2) { const k = Math.min(1, dt * 4); s.position.x -= dx * k; s.position.z -= dz * k; } // Coin Magnet pulls coins in
      if (d2 < COLLECT_DIST2) collectStar(s, true);
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
  noTreeZones.push({ x: 0, z: -16, r: 9 });
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
  noTreeZones.push({ x: 14, z: -14, r: 9 });
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

  // marshmallows roasting on sticks over the fire
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 });
  const mallowMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.75, emissive: 0x3a2a18, emissiveIntensity: 0.15 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), stickMat);
    stick.position.set(Math.cos(a) * 1.1, 0.7, Math.sin(a) * 1.1);
    stick.rotation.z = Math.cos(a) * 0.7;
    stick.rotation.x = -Math.sin(a) * 0.7;
    g.add(stick);
    // marshmallow at the inner (fire) end of the stick
    const mallow = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.18, 4, 8), mallowMat);
    mallow.position.set(Math.cos(a) * 0.35, 0.95, Math.sin(a) * 0.35);
    mallow.castShadow = true;
    g.add(mallow);
  }

  g.position.set(x, 0, z); scene.add(g);
}

// Campsite behind THE STORE & the hospital: the campfire, log seats, and a
// teepee tent for each of the six characters.
const CAMP = { x: 6, z: -31 };
function buildTent(x, z, color, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale);
  const tent = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  tent.position.y = 1.3; tent.castShadow = true; g.add(tent);
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 1 }));
  door.position.set(0, 0.5, 1.42); g.add(door);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), new THREE.MeshStandardMaterial({ color: 0x6b4a2f })); p.position.set(s * 0.12, 2.5, 0); p.rotation.z = s * 0.2; g.add(p); }
  scene.add(g);
}
// one tent for each of the 12 characters; the six who have kids get a small tent beside theirs
const CAMP_TENTS = [
  { color: 0xff9bd2, kid: false }, { color: 0x74e08c, kid: false }, { color: 0xf2c14e, kid: false },
  { color: 0xd9d2c5, kid: false }, { color: 0xece8f6, kid: false }, { color: 0xb18cff, kid: false },
  { color: 0x9aa6c9, kid: true }, { color: 0xe08a4a, kid: true }, { color: 0x8a5a36, kid: true },
  { color: 0x6fae54, kid: true }, { color: 0xe0b84a, kid: true }, { color: 0x4a4a52, kid: true },
];
function buildCampsite() {
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(13, 48), new THREE.MeshStandardMaterial({ color: 0x6e5a3e, roughness: 1 }));
  dirt.rotation.x = -Math.PI / 2; dirt.position.set(CAMP.x, 0.05, CAMP.z); dirt.receiveShadow = true; scene.add(dirt);
  noTreeZones.push({ x: CAMP.x, z: CAMP.z, r: 14 });
  buildCampfire(CAMP.x, CAMP.z); // the campfire + marshmallows live at the campsite now
  const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 8), logMat); log.rotation.z = Math.PI / 2; log.rotation.y = a; log.position.set(CAMP.x + Math.cos(a) * 3.2, 0.22, CAMP.z + Math.sin(a) * 3.2); scene.add(log); }
  CAMP_TENTS.forEach((c, i) => {
    const a = (i / CAMP_TENTS.length) * Math.PI * 2 + 0.26;
    const tx = CAMP.x + Math.cos(a) * 10, tz = CAMP.z + Math.sin(a) * 10;
    buildTent(tx, tz, c.color, 1);
    if (c.kid) buildTent(tx - Math.sin(a) * 2.1, tz + Math.cos(a) * 2.1, c.color, 0.55); // small kid tent beside the parent's
  });
  const sign = makeSign('CAMP'); sign.scale.setScalar(0.55); sign.position.set(CAMP.x, 2.8, CAMP.z - 13); scene.add(sign);
}
buildCampsite();
function updateCampfire(t) {
  const flick = 0.82 + Math.sin(t * 12) * 0.1 + Math.sin(t * 23.3) * 0.08;
  for (const f of campfire.flames) {
    f.scale.y = 0.85 + Math.sin(t * 10 + f.userData.phase) * 0.22;
    f.rotation.y = t * 2 + f.userData.phase;
  }
  if (campfire.light) campfire.light.intensity = (isNight ? 3.4 : 1.7) * flick;
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

// ---------------------------------------------------------------------------
// A pet dog that trots after the player (and climbs stairs with them).
// ---------------------------------------------------------------------------
let petDog = null;
const DOG_NAME = 'Daisy';
function createDog() {
  const tex = textureLoader.load('./assets/characters/dog.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const size = 1.7;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
  );
  mesh.position.y = size / 2;
  const holder = new THREE.Group();
  holder.position.set(4, 0, 7);
  holder.add(mesh);
  const label = makeNameLabel(DOG_NAME);
  label.position.set(0, size + 0.35, 0);
  label.scale.set(2.0, 0.5, 1);
  holder.add(label);
  scene.add(holder);
  petDog = { holder, mesh, baseY: size / 2 };
}
createDog();

// ---- A ball you can throw for the dog to fetch ----
const BALL_R = 0.28;
let ballState = 'idle';            // idle | flying | onground | carried
const ballVel = new THREE.Vector3();
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_R, 16, 12),
  new THREE.MeshStandardMaterial({ color: 0xd7f25a, roughness: 0.6 })
);
ball.castShadow = true; ball.visible = false; scene.add(ball);
const _throwDir = new THREE.Vector3();
function throwBall() {
  if (!player || ballState !== 'idle') return; // one ball at a time
  ball.position.set(player.position.x, player.position.y + 1.4, player.position.z);
  camera.getWorldDirection(_throwDir); _throwDir.y = 0;
  if (_throwDir.lengthSq() === 0) _throwDir.set(0, 0, -1);
  _throwDir.normalize();
  ballVel.copy(_throwDir).multiplyScalar(10); ballVel.y = 7; // forward + up
  ball.visible = true; ballState = 'flying';
}
function updateBall(dt) {
  if (ballState !== 'flying') return;
  ballVel.y -= 18 * dt;            // gravity
  ball.position.addScaledVector(ballVel, dt);
  const groundY = houseFloorHeight(ball.position.x, ball.position.z) + BALL_R;
  if (ball.position.y <= groundY) { ball.position.y = groundY; ballState = 'onground'; }
}

function updateDog(t, dt) {
  if (!petDog) return;
  const h = petDog.holder;
  // pick a target: fetch the ball, carry it back, or follow the player
  let tx, tz, speed = 8, keep = 1.6;
  if (ballState === 'onground') { tx = ball.position.x; tz = ball.position.z; speed = 12; keep = 0.6; }
  else if (ballState === 'carried') { tx = player ? player.position.x : h.position.x; tz = player ? player.position.z : h.position.z; speed = 12; keep = 1.5; }
  else { tx = player ? player.position.x : 4; tz = player ? player.position.z : 7; }

  const dx = tx - h.position.x, dz = tz - h.position.z;
  const d = Math.hypot(dx, dz);
  let moving = false;
  if (d > keep) {
    const step = Math.min(speed * dt, d - keep * 0.7);
    h.position.x += (dx / d) * step;
    h.position.z += (dz / d) * step;
    moving = true;
  }
  h.position.y = houseFloorHeight(h.position.x, h.position.z); // climbs stairs too

  // fetch state transitions
  if (ballState === 'onground' && d <= keep + 0.3) { ballState = 'carried'; }
  if (ballState === 'carried') {
    ball.position.set(h.position.x, h.position.y + 0.55, h.position.z); // in the puppy's mouth
    if (d <= keep + 0.3) { ballState = 'idle'; ball.visible = false; }  // returned to player
  }

  const excited = petDog.barkUntil && t < petDog.barkUntil;
  petDog.mesh.rotation.y = Math.atan2(camera.position.x - h.position.x, camera.position.z - h.position.z);
  petDog.mesh.position.y = petDog.baseY + ((moving || excited) ? Math.abs(Math.sin(t * 12)) * 0.2 : Math.sin(t * 2) * 0.06);
}

// ---------------------------------------------------------------------------
// Daisy's doghouse — a little kennel that sits next to your character's home.
// ---------------------------------------------------------------------------
let doghouse = null;
const doghouseTarget = new THREE.Vector3(3, 0, 3); // moves to your home when you pick a character
function createDoghouse() {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb44a3a, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 1 });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.5), wallMat);
  walls.position.y = 0.5; walls.castShadow = true; g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.8, 4), roofMat);
  roof.position.y = 1.35; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 16, 1, false, 0, Math.PI), darkMat);
  door.rotation.x = Math.PI / 2; door.position.set(0, 0.45, 0.76); g.add(door); // arched doorway
  const doorBase = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.45, 0.2), darkMat);
  doorBase.position.set(0, 0.27, 0.76); g.add(doorBase);
  const label = makeNameLabel(DOG_NAME);
  label.position.set(0, 2.1, 0); label.scale.set(2.0, 0.5, 1);
  g.add(label);
  g.position.set(3, 0, 3);
  scene.add(g);
  doghouse = g;
}
createDoghouse();
function updateDoghouse(dt) {
  if (!doghouse) return;
  const k = Math.min(1, dt * 2.5); // smooth glide toward the home spot
  doghouse.position.x += (doghouseTarget.x - doghouse.position.x) * k;
  doghouse.position.z += (doghouseTarget.z - doghouse.position.z) * k;
  doghouse.position.y = houseFloorHeight(doghouse.position.x, doghouse.position.z);
}

// ---------------------------------------------------------------------------
// Neighborhood + Park: extra families that roam the park with their kids.
// ---------------------------------------------------------------------------
const PARK = { x: -30, z: -8 };
const POND = { x: -30, z: -22 };    // duck pond on the SOUTH side of the park
const PETPARK = { x: -27, z: -9 };  // pet park in the big open centre of the park
let merryGoRound = null; // the spinning park roundabout
let pondSurface = null;  // the pond water mesh (tap it to fish)
const PLAY_STATIONS = []; // playground activity spots (kids run between them to play)
const PET_STATIONS = [];  // pet-park activity spots (cats & dogs play here)
const SLIDE_TOP = new THREE.Vector3();
const SLIDE_BOT = new THREE.Vector3();
const PLAYGROUND = new THREE.Vector3();

// A roaming billboard character (neighbor adult or trailing child).
function spawnRoamer({ id, name, sprite, x, z, scale = 1, roamCenter, roamRadius, roamInner, child = false, parent = null, lines }) {
  const tex = textureLoader.load(`./assets/characters/${sprite}`);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const size = CHAR_HEIGHT * scale;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
  );
  mesh.userData.char = { id, name, lines };
  const baseY = size / 2;
  mesh.position.y = baseY; mesh.userData.baseY = baseY; mesh.userData.bobPhase = Math.random() * 6;
  mesh.userData.accessories = {}; mesh.userData.itemColors = {};
  const holder = new THREE.Group();
  holder.position.set(x, 0, z);
  holder.userData = {
    speed: 1.0 + Math.random() * 0.8,
    target: new THREE.Vector3(x, 0, z),
    pauseUntil: 1 + Math.random() * 2,
    moving: false, mesh,
    roamCenter, roamRadius, roamInner, child, parent,
    tradeGood: randomGood(),
  };
  holder.add(mesh);
  holder.add(makeGroundShadow(size * 0.32));
  const label = makeNameLabel(name);
  label.position.set(0, size + 0.5, 0);
  if (child) label.scale.set(1.6, 0.42, 1);
  holder.add(label);
  const zzz = makeZzzSprite(); zzz.position.set(size * 0.3, size + 0.6, 0); holder.add(zzz); holder.userData.zzz = zzz;
  const ts = makeEmojiSprite('🎁'); ts.position.set(-size * 0.28, size + 0.25, 0); holder.add(ts); holder.userData.tradeSprite = ts;
  const um = makeEmojiSprite('☂️'); um.position.set(0, size * 0.95, 0.06); um.scale.set(size * 0.45, size * 0.45, 1); holder.add(um); holder.userData.umbrella = um;
  characterGroup.add(holder);
  billboards.push(mesh);
  if (!child) holdersById[id] = holder; // adult neighbors are playable
  return holder;
}

// A small animal billboard — either roams an area (center+radius) or, given a
// parent holder, trots along after it as a pet. Not playable, doesn't trade.
function spawnCritter({ sprite, name, lines, scale = 0.6, center, radius = 9, inner = 0, x, z, parent = null }) {
  const tex = textureLoader.load(`./assets/characters/${sprite}`);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const size = CHAR_HEIGHT * scale;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
  );
  mesh.userData.char = { id: 'critter_' + name, name, lines };
  const baseY = size / 2;
  mesh.position.y = baseY; mesh.userData.baseY = baseY; mesh.userData.bobPhase = Math.random() * 6;
  const sx = x != null ? x : (parent ? parent.position.x : (center ? center.x : 0));
  const sz = z != null ? z : (parent ? parent.position.z : (center ? center.z : 0));
  const holder = new THREE.Group();
  holder.position.set(sx, 0, sz);
  holder.userData = {
    speed: 1.3 + Math.random() * 0.9,
    target: new THREE.Vector3(sx, 0, sz),
    pauseUntil: Math.random() * 2, moving: false, mesh,
    roamCenter: center, roamRadius: radius, roamInner: inner,
    child: !!parent, parent, // pets trot after their owner like a child does
    isCritter: true,         // animals don't trade
  };
  holder.add(mesh);
  holder.add(makeGroundShadow(size * 0.32));
  const label = makeNameLabel(name); label.position.set(0, size + 0.45, 0); label.scale.set(1.5, 0.4, 1);
  holder.add(label);
  characterGroup.add(holder);
  billboards.push(mesh);
  return holder;
}

const FOREST_ANIMALS = [
  { sprite: 'fox.png', name: 'Fox', lines: ['Yip yip!', '*swishes fluffy tail*', 'Hello, friend!'] },
  { sprite: 'deer.png', name: 'Fawn', lines: ['*blinks gently*', 'Hi there!', '*nibbles a leaf*'] },
  { sprite: 'squirrel.png', name: 'Nutkin', lines: ['Got any acorns?', 'Scamper scamper!', 'Ooh, shiny!'] },
  { sprite: 'hedgehog.png', name: 'Prickles', lines: ['*tiny sniff*', 'Careful, I\'m pokey!', 'Hehe!'] },
];
function buildForestAnimals() {
  // a lively bunch in the forest — this is where you can always find them
  const spots = [[-6, -2], [4, 3], [-2, 6], [7, -4], [-7, 4], [2, -6]];
  spots.forEach(([dx, dz], i) => {
    const a = FOREST_ANIMALS[i % FOREST_ANIMALS.length];
    spawnCritter({ sprite: a.sprite, name: a.name, lines: a.lines, scale: 0.62, center: FOREST, radius: 9, x: FOREST.x + dx, z: FOREST.z + dz });
  });
}

// ---------------------------------------------------------------------------
// Garden — walk up and tap a plot to plant a seed, watch it grow, then tap the
// grown flower to harvest it for coins. (Plant → sprout → bloom over ~12s.)
// ---------------------------------------------------------------------------
const GARDEN = { x: 24, z: 8 }; // beside the first house (clear of its walls)
const gardenSpots = [];
const GARDEN_SOIL = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
const GARDEN_STEM = new THREE.MeshStandardMaterial({ color: 0x4faf54, roughness: 0.8 });
const cropMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
const _CM = { carrot: cropMat(0xe8862e), tomato: cropMat(0xe23b2e), pumpkin: cropMat(0xe8881e), corn: cropMat(0xf2d24a), berry: cropMat(0xd62a55) };
const M = THREE.Mesh, Co = THREE.ConeGeometry, Cy = THREE.CylinderGeometry, Sp = THREE.SphereGeometry;
// Different crops you can grow — each renders its own ripe shape at stage 3.
const CROPS = [
  { name: 'Carrot', emoji: '🥕', coins: 2, build(p) { const c = new M(new Co(0.22, 0.85, 8), _CM.carrot); c.position.y = 0.45; c.rotation.x = Math.PI; p.add(c); for (const sx of [-1, 0, 1]) { const l = new M(new Co(0.05, 0.5, 5), GARDEN_STEM); l.position.set(sx * 0.12, 0.95, 0); p.add(l); } } },
  { name: 'Tomato', emoji: '🍅', coins: 3, build(p) { const s = new M(new Cy(0.05, 0.06, 0.9, 6), GARDEN_STEM); s.position.y = 0.45; p.add(s); for (const [dx, dy] of [[-0.18, 0.55], [0.18, 0.68], [0, 0.95]]) { const t = new M(new Sp(0.18, 12, 10), _CM.tomato); t.position.set(dx, dy, 0); p.add(t); } } },
  { name: 'Pumpkin', emoji: '🎃', coins: 4, build(p) { const pk = new M(new Sp(0.45, 14, 12), _CM.pumpkin); pk.scale.set(1, 0.8, 1); pk.position.y = 0.4; p.add(pk); const st = new M(new Cy(0.06, 0.08, 0.25, 6), GARDEN_STEM); st.position.y = 0.78; p.add(st); } },
  { name: 'Corn', emoji: '🌽', coins: 3, build(p) { const c = new M(new Cy(0.18, 0.15, 0.95, 8), _CM.corn); c.position.y = 0.6; p.add(c); for (const sx of [-1, 1]) { const l = new M(new Sp(0.12, 8, 6), GARDEN_STEM); l.scale.set(1, 0.3, 2.2); l.position.set(sx * 0.2, 0.5, 0); p.add(l); } } },
  { name: 'Strawberry', emoji: '🍓', coins: 3, build(p) { const s = new M(new Cy(0.05, 0.06, 0.5, 6), GARDEN_STEM); s.position.y = 0.3; p.add(s); for (const [dx, dz] of [[-0.18, 0.1], [0.18, -0.1], [0, 0.2]]) { const b = new M(new Co(0.14, 0.3, 8), _CM.berry); b.position.set(dx, 0.2, dz); b.rotation.x = Math.PI; p.add(b); } } },
];
function renderPlant(rec) {
  rec.plant.clear();
  if (rec.stage === 1) { // seed sprout nub
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), GARDEN_STEM); s.position.y = 0.12; rec.plant.add(s);
  } else if (rec.stage === 2) { // little stem with leaves
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 6), GARDEN_STEM); stem.position.y = 0.3; rec.plant.add(stem);
    for (const sx of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), GARDEN_STEM); leaf.scale.set(1, 0.4, 0.7); leaf.position.set(sx * 0.16, 0.32, 0); rec.plant.add(leaf); }
  } else if (rec.stage >= 3) { // ripe crop (harvestable)
    rec.crop.build(rec.plant);
  }
}
function buildGarden() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.9 });
  const g = new THREE.Group(); g.position.set(GARDEN.x, 0, GARDEN.z); scene.add(g);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 2.2), GARDEN_SOIL); bed.position.y = 0.15; bed.receiveShadow = true; g.add(bed);
  for (const dz of [-1.1, 1.1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.42, 0.2), wood); r.position.set(0, 0.21, dz); g.add(r); }
  for (const dx of [-3.25, 3.25]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 2.3), wood); r.position.set(dx, 0.21, 0); g.add(r); }
  const sign = makeSign('GARDEN'); sign.scale.setScalar(0.5); sign.position.set(GARDEN.x, 2.3, GARDEN.z - 1.7); scene.add(sign);
  noTreeZones.push({ x: GARDEN.x, z: GARDEN.z, r: 5 });
  for (let i = 0; i < 5; i++) {
    const spot = new THREE.Group(); spot.position.set(-2.4 + i * 1.2, 0.3, 0); g.add(spot);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), GARDEN_SOIL);
    mound.userData.isGarden = true; spot.add(mound);
    const plant = new THREE.Group(); spot.add(plant);
    const rec = { mound, plant, stage: 0, plantedAt: 0, crop: CROPS[0] };
    mound.userData.gardenRec = rec; gardenSpots.push(rec);
  }
}
function handleGardenClick(mesh) {
  const rec = mesh.userData.gardenRec; if (!rec) return;
  if (rec.stage === 0) {
    rec.stage = 1; rec.plantedAt = timer.getElapsed();
    rec.crop = CROPS[Math.floor(Math.random() * CROPS.length)];
    renderPlant(rec); if (typeof questToast === 'function') questToast(`Planted ${rec.crop.emoji} ${rec.crop.name}! 🌱 Come back soon…`);
  } else if (rec.stage >= 3) {
    addProduce(rec.crop.coins); if (typeof onCropHarvested === 'function') onCropHarvested();
    if (typeof questToast === 'function') questToast(`Picked ${rec.crop.emoji} ${rec.crop.name}! Sell it at 🏪 THE STORE`);
    rec.stage = 0; rec.plantedAt = 0; renderPlant(rec);
    if (typeof playDing === 'function') playDing();
  } else if (typeof questToast === 'function') {
    questToast('Still growing… 🌱');
  }
}
function updateGarden(t) {
  for (const rec of gardenSpots) {
    if (rec.stage >= 1 && rec.stage < 3) {
      const e = t - rec.plantedAt;
      const ns = e > 12 ? 3 : e > 6 ? 2 : 1;
      if (ns !== rec.stage) { rec.stage = ns; renderPlant(rec); }
    }
  }
}

function buildPark() {
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x77b85a, roughness: 1 });
  const grass = new THREE.Mesh(new THREE.CircleGeometry(26, 56), grassMat); // bigger so everything fits with room to spare
  grass.rotation.x = -Math.PI / 2; grass.position.set(PARK.x, 0.04, PARK.z); grass.receiveShadow = true; scene.add(grass);
  noTreeZones.push({ x: PARK.x, z: PARK.z, r: 27 });
  const sign = makeSign('PARK'); sign.scale.setScalar(0.8); sign.position.set(PARK.x + 18, 3.8, PARK.z); // east edge, by the entrance

  const red = new THREE.MeshStandardMaterial({ color: 0xd64a4a, roughness: 0.6 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x4a8cd6, roughness: 0.6 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.9 });
  const green = new THREE.MeshStandardMaterial({ color: 0x5fb35f, roughness: 0.7 });
  // park props don't cast shadows — dozens of small casters add up in the shadow pass for little gain
  const box = (g, w, h, d, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
  scene.add(sign);

  // ===== PLAYGROUND — between Pochi's house and the pet park =====
  const pgPos = new THREE.Vector3(-38, 0, 2);
  PLAYGROUND.copy(pgPos);
  const pg = new THREE.Group(); pg.position.copy(pgPos); scene.add(pg);
  const station = (arr, lx, lz, extra) => arr.push(Object.assign({ x: pgPos.x + lx, z: pgPos.z + lz }, extra)); // record a play spot
  // slide
  box(pg, 1.2, 0.12, 1.2, yellow, -1, 2.2, 0);                 // top platform
  box(pg, 0.18, 2.2, 0.18, red, -1.5, 1.1, 0.45);
  box(pg, 0.18, 2.2, 0.18, red, -1.5, 1.1, -0.45);
  box(pg, 1.0, 0.1, 3.2, blue, 0.25, 1.15, 1.1, 0.5);         // slide ramp
  SLIDE_TOP.set(pgPos.x - 1, 2.4, pgPos.z);
  SLIDE_BOT.set(pgPos.x + 0.5, 0.4, pgPos.z + 2.5);
  // swing set
  const sw = new THREE.Group(); sw.position.set(3.4, 0, 0); pg.add(sw);
  for (const sz of [-1.2, 1.2]) { box(sw, 0.15, 2.5, 0.15, red, -0.9, 1.25, sz); box(sw, 0.15, 2.5, 0.15, red, 0.9, 1.25, sz); }
  box(sw, 0.16, 0.16, 2.7, red, 0, 2.45, 0);
  for (const sx of [-0.45, 0.45]) { box(sw, 0.03, 1.3, 0.03, wood, sx, 1.75, 0); box(sw, 0.5, 0.1, 0.3, blue, sx, 1.1, 0); }
  // see-saw
  const ss = new THREE.Group(); ss.position.set(0, 0, 3.5); pg.add(ss);
  box(ss, 0.4, 0.5, 0.4, wood, 0, 0.35, 0);
  const plank = box(ss, 0.5, 0.12, 3.4, red, 0, 0.62, 0); plank.rotation.x = 0.12;
  // sandbox
  const sand = new THREE.MeshStandardMaterial({ color: 0xead9a3, roughness: 1 });
  const sb = new THREE.Group(); sb.position.set(-4.5, 0, 3.2); pg.add(sb);
  const sandTop = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), sand); sandTop.rotation.x = -Math.PI / 2; sandTop.position.y = 0.16; sb.add(sandTop);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; box(sb, 0.5, 0.32, 0.22, wood, Math.cos(a) * 1.5, 0.16, Math.sin(a) * 1.5).rotation.y = a; }
  box(sb, 0.5, 0.4, 0.5, yellow, 0.2, 0.36, 0.2); // sandcastle bucket
  // merry-go-round (spins in the render loop)
  const mg = new THREE.Group(); mg.position.set(-4.5, 0, -2.5); pg.add(mg);
  box(mg, 0.3, 0.6, 0.3, wood, 0, 0.3, 0);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.16, 24), blue); disc.position.y = 0.62; mg.add(disc);
  for (let i = 0; i < 4; i++) { const bar = box(mg, 0.08, 0.5, 1.7, red, 0, 0.95, 0); bar.rotation.y = (i / 4) * Math.PI * 2; }
  merryGoRound = mg;
  // monkey bars
  const mb = new THREE.Group(); mb.position.set(4.5, 0, -3.5); pg.add(mb);
  for (const mz of [-1.4, 1.4]) { box(mb, 0.16, 2.0, 0.16, green, -1.6, 1.0, mz); box(mb, 0.16, 2.0, 0.16, green, 1.6, 1.0, mz); }
  for (const mz of [-1.4, 1.4]) box(mb, 3.4, 0.16, 0.16, green, 0, 2.0, mz);
  for (let i = -3; i <= 3; i++) box(mb, 0.12, 0.12, 2.9, yellow, i * 0.5, 2.0, 0);
  // spring rocker
  const sr = new THREE.Group(); sr.position.set(2, 0, 4.6); pg.add(sr);
  box(sr, 0.3, 0.6, 0.3, yellow, 0, 0.3, 0); box(sr, 1.4, 0.5, 0.5, red, 0, 0.8, 0); box(sr, 0.4, 0.5, 0.2, wood, 0.7, 1.1, 0);
  // NEW: climbing cube (jungle gym)
  const cc = new THREE.Group(); cc.position.set(-6.5, 0, -1); pg.add(cc);
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) box(cc, 0.12, 2, 0.12, blue, cx, 1, cz);
  for (const cy of [1, 2]) { for (const cz of [-1, 1]) box(cc, 2.12, 0.12, 0.12, yellow, 0, cy, cz); for (const cx of [-1, 1]) box(cc, 0.12, 0.12, 2.12, yellow, cx, cy, 0); }
  // NEW: balance beam
  const bb = new THREE.Group(); bb.position.set(0.5, 0, -5); pg.add(bb);
  box(bb, 0.3, 0.5, 0.3, wood, -1.6, 0.25, 0); box(bb, 0.3, 0.5, 0.3, wood, 1.6, 0.25, 0);
  box(bb, 3.6, 0.18, 0.3, red, 0, 0.55, 0);
  // record every activity so the kids can run between them and play on each
  station(PLAY_STATIONS, -1.5, 1.6, { slide: true }); // foot of the slide
  station(PLAY_STATIONS, 3.4, 0.8);   // swings
  station(PLAY_STATIONS, 0, 4.8);     // see-saw
  station(PLAY_STATIONS, -4.5, 4.5);  // sandbox
  station(PLAY_STATIONS, -4.5, -2.5); // merry-go-round
  station(PLAY_STATIONS, 4.5, -3.5);  // monkey bars
  station(PLAY_STATIONS, 2, 5.6);     // spring rocker
  station(PLAY_STATIONS, -6.5, -1);   // climbing cube
  station(PLAY_STATIONS, 0.5, -5.8);  // balance beam

  // ===== DUCK POND — south side of the park (tap the water to fish) =====
  const water = new THREE.MeshStandardMaterial({ color: 0x3aa0d6, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.86 });
  const pondGrp = new THREE.Group(); pondGrp.position.set(POND.x, 0, POND.z); scene.add(pondGrp);
  const surf = new THREE.Mesh(new THREE.CircleGeometry(5.8, 44), water); surf.rotation.x = -Math.PI / 2; surf.position.y = 0.12; surf.userData.isPond = true; pondGrp.add(surf); pondSurface = surf;
  const rim = new THREE.MeshStandardMaterial({ color: 0x8d8473, roughness: 1 });
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; box(pondGrp, 0.45, 0.28, 0.3, rim, Math.cos(a) * 5.9, 0.1, Math.sin(a) * 5.9).rotation.y = a; }
  const pad = new THREE.MeshStandardMaterial({ color: 0x4fae54, roughness: 0.8 });
  for (const [px, pz] of [[-2, 1], [2.3, -1.4], [0.6, 2.6]]) { const lp = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), pad); lp.rotation.x = -Math.PI / 2; lp.position.set(px, 0.16, pz); pondGrp.add(lp); }
  const pondSign = makeSign('POND'); pondSign.scale.setScalar(0.45); pondSign.position.set(POND.x, 2.2, POND.z - 6.5); scene.add(pondSign);

  // ===== PET PARK — south side of the park, off the path to town =====
  const dp = new THREE.Group(); dp.position.set(PETPARK.x, 0, PETPARK.z); scene.add(dp);
  const petStation = (lx, lz) => PET_STATIONS.push({ x: PETPARK.x + lx, z: PETPARK.z + lz });
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xcdb892, roughness: 0.9 });
  const R = 5.6;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; box(dp, 0.12, 0.9, 0.12, fenceMat, Math.cos(a) * R, 0.45, Math.sin(a) * R); }
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 8, 20), red); hoop.position.set(0, 0.9, -1.5); dp.add(hoop);
  const hoop2 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 8, 20), blue); hoop2.position.set(-1.4, 0.8, -2.6); dp.add(hoop2); // NEW second hoop
  box(dp, 1.6, 0.12, 1.2, blue, 1.6, 0.5, 1.5, 0.5); box(dp, 1.6, 0.12, 1.2, blue, 1.6, 0.5, 2.7, -0.5); // A-frame
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.8, 16, 1, true), yellow);
  tunnel.rotation.z = Math.PI / 2; tunnel.position.set(-1.8, 0.7, 1.8); tunnel.material.side = THREE.DoubleSide; dp.add(tunnel);
  for (let i = 0; i < 5; i++) box(dp, 0.1, 1.0, 0.1, red, -3 + i * 0.5, 0.5, -2.8); // weave poles
  for (const hx of [3, 3.9]) { box(dp, 0.1, 0.8, 0.1, wood, hx, 0.4, -1.6); box(dp, 0.1, 0.8, 0.1, wood, hx, 0.4, -0.6); box(dp, 0.12, 0.1, 1.1, yellow, hx, 0.7, -1.1); } // hurdles
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 10, 20), wood); tire.position.set(-3.6, 0.9, 0.5); dp.add(tire); // tire jump
  box(dp, 0.7, 0.7, 0.7, wood, 3.2, 0.35, -2.8); box(dp, 0.55, 0.7, 0.55, red, 3.2, 1.05, -2.8); box(dp, 0.9, 0.2, 0.9, blue, 3.2, 1.5, -2.8); // cat tower
  box(dp, 0.18, 1.2, 0.18, wood, -3.8, 0.6, -1.2); // scratching post
  // NEW: dog-walk plank (raised bridge)
  box(dp, 0.3, 0.6, 0.3, wood, -1, 0.3, 3.4); box(dp, 0.3, 0.6, 0.3, wood, 2, 0.3, 3.4); box(dp, 3.4, 0.16, 0.6, green, 0.5, 0.65, 3.4);
  // NEW: ball pit
  const bp = new THREE.Group(); bp.position.set(2.6, 0, 1.6); dp.add(bp);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; box(bp, 0.3, 0.4, 0.2, fenceMat, Math.cos(a) * 1.1, 0.2, Math.sin(a) * 1.1).rotation.y = a; }
  const ballCols = [red, blue, yellow, green];
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), ballCols[i % 4]); b.position.set((Math.random() - 0.5) * 1.4, 0.22, (Math.random() - 0.5) * 1.4); bp.add(b); }
  const bone = makeSign('PET PARK'); bone.scale.setScalar(0.5); bone.position.set(PETPARK.x, 2.6, PETPARK.z - 7); scene.add(bone);
  // record pet-park activities so cats & dogs run between them and play on each
  petStation(0, -1.5); petStation(-1.4, -2.6); petStation(1.6, 2);  // hoops, A-frame
  petStation(-1.8, 1.8); petStation(-1, -2.8); petStation(3.4, -1.1); // tunnel, weave, hurdles
  petStation(-3.6, 0.5); petStation(3.2, -2.8); petStation(0.5, 3.4); petStation(2.6, 1.6); // tire, tower, dog-walk, ball pit

  // lamp posts spread around the bigger park so it all glows at night
  makeLampPost(PLAYGROUND.x + 6, PLAYGROUND.z - 6); makeLampPost(PLAYGROUND.x - 6, PLAYGROUND.z + 4); // by the playground
  makeLampPost(PETPARK.x + 7, PETPARK.z + 3); makeLampPost(PETPARK.x - 7, PETPARK.z - 3);             // by the pet park
  makeLampPost(POND.x + 6, POND.z + 4); makeLampPost(POND.x - 5, POND.z - 4);                          // by the pond
  makeLampPost(PARK.x + 14, PARK.z);       // by the east entrance
  makeLampPost(PARK.x, PARK.z);            // park centre
}

const NEIGHBORS = [
  { id: 'pip', name: 'Pip', sprite: 'pip.png', wall: 0xe8e0ea, roof: 0x9aa6c9, lines: ['Hi neighbor!', 'Lovely day!', 'Hop hop!'] },
  { id: 'coco', name: 'Coco', sprite: 'coco.png', wall: 0xf4dcb6, roof: 0xe08a4a, lines: ['Meow!', 'Off to the park!', 'Purr~'] },
  { id: 'bruno', name: 'Bruno', sprite: 'bruno.png', wall: 0xe6cba0, roof: 0x8a5a36, lines: ['Hello there!', 'Nice to meet you!', 'Grr-iendly!'] },
];
// New families, each living right next to one of the three neighbors above.
// They roam the park, have a child, and bring a pet that trots along.
const NEIGHBORS2 = [
  { id: 'fern', name: 'Fern', sprite: 'frog.png', wall: 0xcfe8c0, roof: 0x6fae54, lines: ['Ribbit!', 'Hop along with me!', 'Splish splash!'], ang: 60, pet: 'cat.png', petName: 'Mochi' },
  { id: 'quacky', name: 'Quacky', sprite: 'duck.png', wall: 0xf6ecc0, roof: 0xe0b84a, lines: ['Quack quack!', 'Off to the pond!', 'Waddle waddle!'], ang: 108, pet: 'dog.png', petName: 'Biscuit' },
  { id: 'pochi', name: 'Pochi', sprite: 'panda.png', wall: 0xe9e9ee, roof: 0x4a4a52, lines: ['Munch munch!', 'Bamboo, yum!', 'Hehe, hello!'], ang: 156, pet: 'cat.png', petName: 'Yuki' },
];
function buildNeighborhood() {
  // path from the courtyard out to the park
  buildPath(-6, 0, -18, -4); buildPath(-18, -4, PARK.x + 2, PARK.z);
  buildPark();
  const R2 = 28;                         // neighbor homes BEHIND the six houses
  const angs = [42, 90, 138];
  NEIGHBORS.forEach((n, i) => {
    const a = angs[i] * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const hx = cs * R2, hz = sn * R2;
    buildHouse({ x: hx, z: hz, rotationY: Math.atan2(-hx, -hz), name: n.name, wall: n.wall, roof: n.roof });
    buildPath(cs * 19, sn * 19, cs * (R2 - 2.5), sn * (R2 - 2.5)); // path behind the six to this home
    const parent = spawnRoamer({
      id: n.id, name: n.name, sprite: n.sprite,
      x: PARK.x + (i - 1) * 4, z: PARK.z + (i - 1) * 3,
      roamCenter: PARK, roamInner: 2, roamRadius: 13, lines: n.lines, // roam the spacious park
    });
    parent.userData.wander = true; parent.userData.angler = i === 2; // Bruno likes to fish
    spawnRoamer({ id: n.id + '_kid', name: n.name + ' Jr.', sprite: n.sprite, x: PARK.x, z: PARK.z, scale: 0.6, child: true, parent, lines: ['Wheee!', 'Tag, you\'re it!', 'Hehe!'] }).userData.playArea = 'playground';
  });
  // a few more houses & families right beside Pip, Coco and Bruno
  const R3 = 31;
  NEIGHBORS2.forEach((n) => {
    const a = n.ang * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const hx = cs * R3, hz = sn * R3;
    buildHouse({ x: hx, z: hz, rotationY: Math.atan2(-hx, -hz), name: n.name, wall: n.wall, roof: n.roof });
    buildPath(cs * 20, sn * 20, cs * (R3 - 2.5), sn * (R3 - 2.5));
    // Quacky the duck and her kid live at the pond and paddle around in it
    const atPond = n.id === 'quacky';
    const center = atPond ? POND : PARK;
    const parent = spawnRoamer({
      id: n.id, name: n.name, sprite: n.sprite,
      x: center.x + (Math.random() * 4 - 2), z: center.z + (Math.random() * 4 - 2),
      roamCenter: center, roamInner: 0, roamRadius: atPond ? 2.6 : 13, lines: n.lines,
    });
    parent.userData.wander = true; parent.userData.angler = n.id === 'pochi'; // everyone wanders (the pond is one of the wander zones)
    const kid = spawnRoamer({ id: n.id + '_kid', name: n.name + ' Jr.', sprite: n.sprite, x: center.x, z: center.z, scale: 0.6, child: true, parent, lines: ['Wheee!', 'Look at me!', 'Hehe!'] });
    kid.userData.playArea = 'playground';
    if (atPond) { parent.userData.swimmer = true; kid.userData.swimmer = true; kid.userData.playArea = null; } // pond kids paddle, not playground
    spawnCritter({ sprite: n.pet, name: n.petName, lines: ['(purrs)', '(happy wag)', '(nuzzles you)'], scale: 0.5, parent }).userData.playArea = 'petpark';
  });
  // a couple of friendly cats roaming the park
  spawnCritter({ sprite: 'cat.png', name: 'Tabby', lines: ['Meow!', 'Purr~', '*chases a leaf*'], scale: 0.5, center: PARK, radius: 14 }).userData.playArea = 'petpark';
  spawnCritter({ sprite: 'cat.png', name: 'Patches', lines: ['Mrow?', '*pounces*', 'Purrrr'], scale: 0.5, center: PARK, radius: 14 }).userData.playArea = 'petpark';
}

// ---------------------------------------------------------------------------
// Quests & side quests — earn stars (XP) from a mini-puzzle and by helping
// cute animals that come out of the forest looking for lost things.
// ---------------------------------------------------------------------------
const FOREST = { x: 30, z: 8 };
function buildForest() {
  let seed = 99; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const files = ['tree-high-round.glb', 'tree.glb', 'tree-crooked.glb'];
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 8;
    loadModel(files[i % 3], { position: [FOREST.x + Math.cos(a) * r, 0, FOREST.z + Math.sin(a) * r], rotationY: rnd() * 6, scale: 2.0 + rnd() * 1.3 });
  }
  noTreeZones.push({ x: FOREST.x, z: FOREST.z, r: 12 });
}

const quests = [
  { id: 'coins', name: 'Collect 12 coins', target: 12, prog: 0, reward: 5, done: false },
  { id: 'trade', name: 'Trade with 3 friends', target: 3, prog: 0, reward: 5, done: false },
  { id: 'pet', name: 'Pet Daisy 3 times', target: 3, prog: 0, reward: 5, done: false },
  { id: 'fish', name: 'Catch 3 fish 🎣', target: 3, prog: 0, reward: 6, done: false },
  { id: 'crop', name: 'Harvest 4 crops 🥕', target: 4, prog: 0, reward: 6, done: false },
  { id: 'puzzle', name: 'Win the Memory game', target: 1, prog: 0, reward: 10, done: false, puzzle: true, game: 'memory' },
  { id: 'merge', name: 'Win Fruit Merge', target: 1, prog: 0, reward: 10, done: false, puzzle: true, game: 'merge' },
  { id: 'tetris', name: 'Clear 3 lines (Tetris)', target: 1, prog: 0, reward: 10, done: false, puzzle: true, game: 'tetris' },
  { id: 'match', name: 'Win Match Pairs', target: 1, prog: 0, reward: 8, done: false, puzzle: true, game: 'match' },
  { id: 'snake', name: 'Score 5 in Snake', target: 1, prog: 0, reward: 10, done: false, puzzle: true, game: 'snake' },
];
function questBump(id) {
  const q = quests.find((x) => x.id === id);
  if (!q || q.done) return;
  q.prog = Math.min(q.target, q.prog + 1);
  if (q.prog >= q.target) completeQuest(q);
  else if (questOpen) refreshQuests();
}
function completeQuest(q) {
  if (q.done) return;
  q.done = true; addStars(q.reward);
  questToast(`✅ ${q.name} — +${q.reward} ✨`);
  if (questOpen) refreshQuests();
  if (typeof saveGame === 'function') saveGame();
}
function onCoinCollected() { questBump('coins'); }
function onTrade() { questBump('trade'); }
function onPetDog() { questBump('pet'); }
function onFishCaught() { questBump('fish'); }
function onCropHarvested() { questBump('crop'); }
function resetQuests() {
  for (const q of quests) { q.prog = 0; q.done = false; }
  if (sideQuest) { scene.remove(sideQuest.item); scene.remove(sideQuest.animal); sideQuest = null; }
  nextSideQuestAt = 25;
  if (questOpen) refreshQuests();
}
function getQuestSave() { return { done: quests.filter((q) => q.done).map((q) => q.id), prog: Object.fromEntries(quests.map((q) => [q.id, q.prog])) }; }
function setQuestSave(s) { for (const q of quests) { if (s.done && s.done.includes(q.id)) q.done = true; if (s.prog && s.prog[q.id] != null) q.prog = s.prog[q.id]; } if (questOpen) refreshQuests(); }

// ---- Quest panel UI ----
let questEl = null, questOpen = false, questListEl = null;
function buildQuestPanel() {
  questEl = document.createElement('div'); questEl.id = 'questpanel'; questEl.style.display = 'none';
  const h = document.createElement('h3'); h.append('🎯 Quests');
  const sub = document.createElement('p'); sub.className = 'shop-sub'; sub.textContent = 'Finish quests to earn ✨ stars & level up!';
  questListEl = document.createElement('div'); questListEl.className = 'shop-list';
  questEl.append(h, sub, questListEl);
  document.body.appendChild(questEl);
}
function refreshQuests() {
  if (!questListEl) return;
  questListEl.replaceChildren();
  quests.forEach((q) => {
    const row = document.createElement('div'); row.className = 'shop-item';
    if (q.done) row.classList.add('worn');
    const lbl = document.createElement('span'); lbl.textContent = `${q.name}`;
    const right = document.createElement('span'); right.className = 'shop-price';
    if (q.done) right.textContent = '✓ done';
    else if (q.puzzle) { const b = document.createElement('button'); b.className = 'shop-price'; b.style.cursor = 'pointer'; b.textContent = '▶ Play'; b.addEventListener('click', () => startMiniGame(q.game)); right.appendChild(b); }
    else right.textContent = `${q.prog}/${q.target}  +${q.reward}✨`;
    row.append(lbl, right);
    questListEl.appendChild(row);
  });
  // active side quest, if any
  if (sideQuest) {
    const row = document.createElement('div'); row.className = 'shop-item';
    row.append(Object.assign(document.createElement('span'), { textContent: `Find the lost ${sideQuest.emoji}` }),
      Object.assign(document.createElement('span'), { className: 'shop-price', textContent: `+8✨` }));
    questListEl.appendChild(row);
  }
}
function openQuests() { if (typeof tradeOpen !== 'undefined' && tradeOpen) closeTrade(); questOpen = true; refreshQuests(); questEl.style.display = 'block'; animate(questEl, { opacity: [0, 1], duration: 240, ease: 'out(3)' }); }
function closeQuests() { questOpen = false; animate(questEl, { opacity: [1, 0], duration: 200, onComplete: () => { questEl.style.display = 'none'; } }); }
let toastEl = null;
function questToast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'questtoast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.style.display = 'block';
  animate(toastEl, { opacity: [0, 1], translateY: [12, 0], duration: 300, ease: 'out(3)' });
  clearTimeout(toastEl._t); toastEl._t = setTimeout(() => { animate(toastEl, { opacity: 0, duration: 400, onComplete: () => { toastEl.style.display = 'none'; } }); }, 2600);
}

// ---- Memory mini-puzzle (repeat the color pattern) ----
let puzzleEl = null, puzzlePads = [], puzzleSeq = [], puzzleInput = [], puzzleLocked = true;
const PUZZLE_COLORS = [0xff5a5a, 0x74e08c, 0x6aa6ff, 0xffe066];
function buildPuzzle() {
  puzzleEl = document.createElement('div'); puzzleEl.id = 'puzzle'; puzzleEl.style.display = 'none';
  const panel = document.createElement('div'); panel.className = 'puzzle-panel';
  const h = document.createElement('h3'); h.textContent = '🧠 Memory Game';
  const msg = document.createElement('p'); msg.className = 'puzzle-msg'; msg.textContent = 'Watch the colors, then repeat!';
  const grid = document.createElement('div'); grid.className = 'puzzle-grid';
  PUZZLE_COLORS.forEach((c, i) => {
    const pad = document.createElement('button'); pad.className = 'puzzle-pad';
    pad.style.background = '#' + c.toString(16).padStart(6, '0');
    pad.addEventListener('click', () => padClick(i));
    grid.appendChild(pad); puzzlePads.push(pad);
  });
  const close = document.createElement('button'); close.className = 'puzzle-close'; close.textContent = 'Close';
  close.addEventListener('click', () => { puzzleEl.style.display = 'none'; });
  puzzleEl._msg = msg;
  panel.append(h, msg, grid, close);
  puzzleEl.appendChild(panel); document.body.appendChild(puzzleEl);
}
function flashPad(i) { const p = puzzlePads[i]; p.classList.add('lit'); setTimeout(() => p.classList.remove('lit'), 360); }
function startPuzzle() {
  if (!puzzleEl) return;
  puzzleEl.style.display = 'flex'; puzzleEl._msg.textContent = 'Watch carefully…';
  puzzleSeq = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4));
  puzzleInput = []; puzzleLocked = true;
  let k = 0;
  const tick = () => {
    if (k >= puzzleSeq.length) { puzzleLocked = false; puzzleEl._msg.textContent = 'Now repeat it!'; return; }
    flashPad(puzzleSeq[k]); k++; setTimeout(tick, 620);
  };
  setTimeout(tick, 600);
}
function padClick(i) {
  if (puzzleLocked || puzzleEl.style.display === 'none') return;
  flashPad(i); puzzleInput.push(i);
  const idx = puzzleInput.length - 1;
  if (puzzleInput[idx] !== puzzleSeq[idx]) { puzzleEl._msg.textContent = 'Oops! Try again 🙂'; puzzleLocked = true; setTimeout(startPuzzle, 900); return; }
  if (puzzleInput.length === puzzleSeq.length) {
    puzzleLocked = true; puzzleEl._msg.textContent = 'You did it! 🎉';
    winMiniGame('puzzle');
    setTimeout(() => { puzzleEl.style.display = 'none'; }, 1100);
  }
}

// ---- Mini-game dispatch + shared helpers ----
function startMiniGame(game) {
  if (game === 'merge') startMerge();
  else if (game === 'tetris') startTetris();
  else if (game === 'match') startMatch();
  else if (game === 'snake') startSnake();
  else startPuzzle();
}
function winMiniGame(questId) { const q = quests.find((x) => x.id === questId); if (q && !q.done) completeQuest(q); }
function miniGameActive() {
  return (puzzleEl && puzzleEl.style.display !== 'none')
    || (mergeEl && mergeEl.style.display !== 'none')
    || (tetEl && tetEl.style.display !== 'none')
    || (matchEl && matchEl.style.display !== 'none')
    || (snakeEl && snakeEl.style.display !== 'none')
    || (battleEl && battleEl.style.display !== 'none');
}

// ---- Fruit Merge (slide to merge matching fruits, 2048-style) ----
const MERGE_FRUITS = ['', '🍒', '🍓', '🍇', '🍊', '🍎', '🍉', '👑'];
const MERGE_WIN = 6; // reach 🍉
let mergeEl = null, mergeCells = [], mergeBoard = null, mergeMsg = null, mergeOver = true;
function buildMerge() {
  mergeEl = document.createElement('div'); mergeEl.id = 'merge'; mergeEl.className = 'gamemodal'; mergeEl.style.display = 'none';
  const panel = document.createElement('div'); panel.className = 'puzzle-panel';
  const h = document.createElement('h3'); h.textContent = '🍉 Fruit Merge';
  mergeMsg = document.createElement('p'); mergeMsg.className = 'puzzle-msg'; mergeMsg.textContent = 'Slide to merge matching fruits — reach 🍉!';
  const grid = document.createElement('div'); grid.className = 'merge-grid';
  for (let i = 0; i < 16; i++) { const c = document.createElement('div'); c.className = 'merge-cell'; grid.appendChild(c); mergeCells.push(c); }
  const pad = document.createElement('div'); pad.className = 'dpad';
  const mk = (label, dir) => { const b = document.createElement('button'); b.className = 'dpad-btn'; b.textContent = label; b.addEventListener('click', () => mergeMove(dir)); return b; };
  pad.append(mk('⬅️', 'left'), mk('⬆️', 'up'), mk('⬇️', 'down'), mk('➡️', 'right'));
  const close = document.createElement('button'); close.className = 'puzzle-close'; close.textContent = 'Close'; close.addEventListener('click', () => { mergeOver = true; mergeEl.style.display = 'none'; });
  panel.append(h, mergeMsg, grid, pad, close);
  mergeEl.appendChild(panel); document.body.appendChild(mergeEl);
}
function startMerge() {
  if (!mergeEl) buildMerge();
  keys.clear();
  mergeBoard = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  mergeOver = false; mergeMsg.textContent = 'Slide to merge — reach 🍉!';
  mergeAddRandom(); mergeAddRandom(); mergeRender();
  mergeEl.style.display = 'flex';
}
function mergeAddRandom() {
  const empty = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!mergeBoard[r][c]) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  mergeBoard[r][c] = Math.random() < 0.85 ? 1 : 2;
}
function mergeRender() {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const v = mergeBoard[r][c]; const cell = mergeCells[r * 4 + c];
    cell.textContent = v ? MERGE_FRUITS[v] : '';
    cell.style.background = v ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)';
  }
}
function mergeMove(dir) {
  if (mergeOver) return;
  const before = JSON.stringify(mergeBoard);
  const get = (r, c) => dir === 'left' ? mergeBoard[r][c] : dir === 'right' ? mergeBoard[r][3 - c] : dir === 'up' ? mergeBoard[c][r] : mergeBoard[3 - c][r];
  const set = (r, c, v) => { if (dir === 'left') mergeBoard[r][c] = v; else if (dir === 'right') mergeBoard[r][3 - c] = v; else if (dir === 'up') mergeBoard[c][r] = v; else mergeBoard[3 - c][r] = v; };
  for (let r = 0; r < 4; r++) {
    let arr = [get(r, 0), get(r, 1), get(r, 2), get(r, 3)].filter((v) => v);
    for (let i = 0; i < arr.length - 1; i++) if (arr[i] === arr[i + 1]) { arr[i]++; arr.splice(i + 1, 1); }
    while (arr.length < 4) arr.push(0);
    for (let c = 0; c < 4; c++) set(r, c, arr[c]);
  }
  if (JSON.stringify(mergeBoard) === before) return; // nothing moved
  let maxv = 0; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) maxv = Math.max(maxv, mergeBoard[r][c]);
  if (maxv >= MERGE_WIN) { mergeRender(); mergeMsg.textContent = 'You made a 🍉! 🎉'; mergeOver = true; winMiniGame('merge'); setTimeout(() => { mergeEl.style.display = 'none'; }, 1300); return; }
  mergeAddRandom(); mergeRender();
  if (!mergeCanMove()) { mergeMsg.textContent = 'No moves left — Close & retry'; mergeOver = true; }
}
function mergeCanMove() {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (!mergeBoard[r][c]) return true;
    if (c < 3 && mergeBoard[r][c] === mergeBoard[r][c + 1]) return true;
    if (r < 3 && mergeBoard[r][c] === mergeBoard[r + 1][c]) return true;
  }
  return false;
}

// ---- Tetris (clear 3 lines to win) ----
const TET_COLS = 10, TET_ROWS = 16, TET_CELL = 18;
const TET_SHAPES = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[0, 1, 1], [1, 1, 0]], [[1, 1, 0], [0, 1, 1]]];
const TET_COLORS = ['#5ad1e0', '#f2d24a', '#b18cff', '#6aa6ff', '#e8881e', '#74e08c', '#ff5a5a'];
let tetEl = null, tetCanvas = null, tetCtx = null, tetMsg = null, tetBoard = null, tetPiece = null, tetTimer = 0, tetLines = 0, tetOver = true;
function buildTetris() {
  tetEl = document.createElement('div'); tetEl.id = 'tetris'; tetEl.className = 'gamemodal'; tetEl.style.display = 'none';
  const panel = document.createElement('div'); panel.className = 'puzzle-panel';
  const h = document.createElement('h3'); h.textContent = '🟦 Tetris';
  tetMsg = document.createElement('p'); tetMsg.className = 'puzzle-msg'; tetMsg.textContent = 'Clear 3 lines to win!';
  tetCanvas = document.createElement('canvas'); tetCanvas.width = TET_COLS * TET_CELL; tetCanvas.height = TET_ROWS * TET_CELL; tetCanvas.className = 'tet-canvas'; tetCtx = tetCanvas.getContext('2d');
  const pad = document.createElement('div'); pad.className = 'dpad';
  const mk = (l, fn) => { const b = document.createElement('button'); b.className = 'dpad-btn'; b.textContent = l; b.addEventListener('click', fn); return b; };
  pad.append(mk('⬅️', () => tetMove(-1, 0)), mk('🔄', tetRotate), mk('⬇️', () => tetMove(0, 1)), mk('➡️', () => tetMove(1, 0)));
  const close = document.createElement('button'); close.className = 'puzzle-close'; close.textContent = 'Close'; close.addEventListener('click', closeTetris);
  panel.append(h, tetMsg, tetCanvas, pad, close);
  tetEl.appendChild(panel); document.body.appendChild(tetEl);
}
function startTetris() {
  if (!tetEl) buildTetris();
  keys.clear();
  tetBoard = Array.from({ length: TET_ROWS }, () => new Array(TET_COLS).fill(-1));
  tetLines = 0; tetOver = false; tetMsg.textContent = 'Clear 3 lines to win!';
  tetSpawn(); tetDraw(); tetEl.style.display = 'flex';
  clearInterval(tetTimer); tetTimer = setInterval(() => { if (!tetOver && !tetMove(0, 1)) tetLock(); }, 600);
}
function closeTetris() { tetOver = true; clearInterval(tetTimer); tetEl.style.display = 'none'; }
function tetCollide(shape, px, py) {
  for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) {
    if (!shape[r][c]) continue;
    const x = px + c, y = py + r;
    if (x < 0 || x >= TET_COLS || y >= TET_ROWS) return true;
    if (y >= 0 && tetBoard[y][x] >= 0) return true;
  }
  return false;
}
function tetSpawn() {
  const idx = Math.floor(Math.random() * TET_SHAPES.length);
  const shape = TET_SHAPES[idx].map((row) => row.slice());
  tetPiece = { shape, color: idx, x: Math.floor((TET_COLS - shape[0].length) / 2), y: 0 };
  if (tetCollide(shape, tetPiece.x, tetPiece.y)) { tetOver = true; clearInterval(tetTimer); tetMsg.textContent = 'Topped out — Close & retry'; }
}
function tetMove(dx, dy) {
  if (tetOver || !tetPiece) return false;
  if (tetCollide(tetPiece.shape, tetPiece.x + dx, tetPiece.y + dy)) return false;
  tetPiece.x += dx; tetPiece.y += dy; tetDraw(); return true;
}
function tetRotate() {
  if (tetOver || !tetPiece) return;
  const s = tetPiece.shape, rot = s[0].map((_, c) => s.map((row) => row[c]).reverse());
  if (!tetCollide(rot, tetPiece.x, tetPiece.y)) { tetPiece.shape = rot; tetDraw(); }
}
function tetLock() {
  const { shape, color, x, y } = tetPiece;
  for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) if (shape[r][c] && y + r >= 0) tetBoard[y + r][x + c] = color;
  for (let r = TET_ROWS - 1; r >= 0; r--) if (tetBoard[r].every((v) => v >= 0)) { tetBoard.splice(r, 1); tetBoard.unshift(new Array(TET_COLS).fill(-1)); tetLines++; r++; }
  if (tetLines > 0) tetMsg.textContent = `Lines: ${tetLines}/3`;
  if (tetLines >= 3) { tetOver = true; clearInterval(tetTimer); tetMsg.textContent = '3 lines! 🎉'; winMiniGame('tetris'); setTimeout(closeTetris, 1300); return; }
  tetSpawn(); tetDraw();
}
function tetDraw() {
  const ctx = tetCtx; ctx.clearRect(0, 0, tetCanvas.width, tetCanvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, tetCanvas.width, tetCanvas.height);
  const cell = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x * TET_CELL + 1, y * TET_CELL + 1, TET_CELL - 2, TET_CELL - 2); };
  for (let r = 0; r < TET_ROWS; r++) for (let c = 0; c < TET_COLS; c++) if (tetBoard[r][c] >= 0) cell(c, r, TET_COLORS[tetBoard[r][c]]);
  if (tetPiece) { const { shape, color, x, y } = tetPiece; for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) if (shape[r][c] && y + r >= 0) cell(x + c, y + r, TET_COLORS[color]); }
}
// keyboard for the open mini-game (registered before the movement handler, so it wins)
window.addEventListener('keydown', (e) => {
  if (mergeEl && mergeEl.style.display !== 'none' && !mergeOver) {
    const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (m[e.key]) { e.preventDefault(); mergeMove(m[e.key]); }
  } else if (tetEl && tetEl.style.display !== 'none' && !tetOver) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); tetMove(-1, 0); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); tetMove(1, 0); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); tetMove(0, 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); tetRotate(); }
  } else if (snakeEl && snakeEl.style.display !== 'none' && !snakeOver) {
    const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (d[e.key]) { e.preventDefault(); snakeTurn(d[e.key]); }
  }
});

// ---- Match Pairs (flip cards to find matching pairs) ----
const MATCH_EMOJI = ['🍎', '🐶', '⭐', '🌸', '🎈', '🐱'];
let matchEl = null, matchGrid = null, matchMsg = null, matchCards = [], matchUp = [], matchLock = false, matchDone = 0;
function buildMatch() {
  matchEl = document.createElement('div'); matchEl.id = 'match'; matchEl.className = 'gamemodal'; matchEl.style.display = 'none';
  const panel = document.createElement('div'); panel.className = 'puzzle-panel';
  const h = document.createElement('h3'); h.textContent = '🃏 Match Pairs';
  matchMsg = document.createElement('p'); matchMsg.className = 'puzzle-msg'; matchMsg.textContent = 'Find all the matching pairs!';
  matchGrid = document.createElement('div'); matchGrid.className = 'match-grid';
  const close = document.createElement('button'); close.className = 'puzzle-close'; close.textContent = 'Close'; close.addEventListener('click', () => { matchEl.style.display = 'none'; });
  panel.append(h, matchMsg, matchGrid, close);
  matchEl.appendChild(panel); document.body.appendChild(matchEl);
}
function startMatch() {
  if (!matchEl) buildMatch();
  const deck = [...MATCH_EMOJI, ...MATCH_EMOJI].sort(() => Math.random() - 0.5);
  matchGrid.replaceChildren(); matchCards = []; matchUp = []; matchLock = false; matchDone = 0;
  matchMsg.textContent = 'Find all the matching pairs!';
  deck.forEach((emoji, i) => {
    const card = document.createElement('button'); card.className = 'match-card'; card.textContent = '?';
    card.addEventListener('click', () => matchFlip(i));
    matchGrid.appendChild(card); matchCards.push({ card, emoji, up: false, done: false });
  });
  matchEl.style.display = 'flex';
}
function matchFlip(i) {
  const c = matchCards[i];
  if (matchLock || c.up || c.done) return;
  c.up = true; c.card.textContent = c.emoji; c.card.classList.add('up'); matchUp.push(i);
  if (matchUp.length === 2) {
    matchLock = true;
    const [a, b] = matchUp;
    if (matchCards[a].emoji === matchCards[b].emoji) {
      matchCards[a].done = matchCards[b].done = true; matchDone++;
      matchUp = []; matchLock = false;
      if (matchDone === MATCH_EMOJI.length) { matchMsg.textContent = 'All matched! 🎉'; winMiniGame('match'); setTimeout(() => { matchEl.style.display = 'none'; }, 1200); }
    } else {
      setTimeout(() => {
        for (const k of matchUp) { matchCards[k].up = false; matchCards[k].card.textContent = '?'; matchCards[k].card.classList.remove('up'); }
        matchUp = []; matchLock = false;
      }, 750);
    }
  }
}

// ---- Snake (eat 5 apples to win) ----
const SNK_N = 13, SNK_CELL = 18;
let snakeEl = null, snakeCanvas = null, snakeCtx = null, snakeMsg = null, snakeBody = null, snakeDir = null, snakeNext = null, snakeFood = null, snakeScore = 0, snakeTimer = 0, snakeOver = true;
function buildSnake() {
  snakeEl = document.createElement('div'); snakeEl.id = 'snake'; snakeEl.className = 'gamemodal'; snakeEl.style.display = 'none';
  const panel = document.createElement('div'); panel.className = 'puzzle-panel';
  const h = document.createElement('h3'); h.textContent = '🐍 Snake';
  snakeMsg = document.createElement('p'); snakeMsg.className = 'puzzle-msg'; snakeMsg.textContent = 'Eat 5 apples 🍎 to win!';
  snakeCanvas = document.createElement('canvas'); snakeCanvas.width = SNK_N * SNK_CELL; snakeCanvas.height = SNK_N * SNK_CELL; snakeCanvas.className = 'tet-canvas'; snakeCtx = snakeCanvas.getContext('2d');
  const pad = document.createElement('div'); pad.className = 'dpad';
  const mk = (l, dx, dy) => { const b = document.createElement('button'); b.className = 'dpad-btn'; b.textContent = l; b.addEventListener('click', () => snakeTurn([dx, dy])); return b; };
  pad.append(mk('⬅️', -1, 0), mk('⬆️', 0, -1), mk('⬇️', 0, 1), mk('➡️', 1, 0));
  const close = document.createElement('button'); close.className = 'puzzle-close'; close.textContent = 'Close'; close.addEventListener('click', closeSnake);
  panel.append(h, snakeMsg, snakeCanvas, pad, close);
  snakeEl.appendChild(panel); document.body.appendChild(snakeEl);
}
function startSnake() {
  if (!snakeEl) buildSnake();
  keys.clear();
  snakeBody = [[6, 6], [5, 6], [4, 6]]; snakeDir = [1, 0]; snakeNext = [1, 0]; snakeScore = 0; snakeOver = false;
  snakeMsg.textContent = 'Eat 5 apples 🍎 to win!';
  snakePlaceFood(); snakeDraw();
  snakeEl.style.display = 'flex';
  clearInterval(snakeTimer); snakeTimer = setInterval(snakeStep, 220);
}
function closeSnake() { snakeOver = true; clearInterval(snakeTimer); snakeEl.style.display = 'none'; }
function snakeTurn(d) { if (d[0] === -snakeDir[0] && d[1] === -snakeDir[1]) return; snakeNext = d; } // no reversing
function snakePlaceFood() {
  do { snakeFood = [Math.floor(Math.random() * SNK_N), Math.floor(Math.random() * SNK_N)]; }
  while (snakeBody.some(([x, y]) => x === snakeFood[0] && y === snakeFood[1]));
}
function snakeStep() {
  if (snakeOver) return;
  snakeDir = snakeNext;
  const head = [snakeBody[0][0] + snakeDir[0], snakeBody[0][1] + snakeDir[1]];
  if (head[0] < 0 || head[1] < 0 || head[0] >= SNK_N || head[1] >= SNK_N || snakeBody.some(([x, y]) => x === head[0] && y === head[1])) {
    snakeOver = true; clearInterval(snakeTimer); snakeMsg.textContent = 'Oops! Close & retry'; return;
  }
  snakeBody.unshift(head);
  if (head[0] === snakeFood[0] && head[1] === snakeFood[1]) {
    snakeScore++; snakeMsg.textContent = `Apples: ${snakeScore}/5`;
    if (snakeScore >= 5) { snakeOver = true; clearInterval(snakeTimer); snakeMsg.textContent = '5 apples! 🎉'; winMiniGame('snake'); setTimeout(closeSnake, 1300); return; }
    snakePlaceFood();
  } else { snakeBody.pop(); }
  snakeDraw();
}
function snakeDraw() {
  const ctx = snakeCtx; ctx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  ctx.font = `${SNK_CELL - 2}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🍎', snakeFood[0] * SNK_CELL + SNK_CELL / 2, snakeFood[1] * SNK_CELL + SNK_CELL / 2);
  snakeBody.forEach(([x, y], i) => { ctx.fillStyle = i === 0 ? '#74e08c' : '#4faf54'; ctx.fillRect(x * SNK_CELL + 1, y * SNK_CELL + 1, SNK_CELL - 2, SNK_CELL - 2); });
}

// ---- Fishing at the pond (players & roaming anglers) ----
let fishing = null;
const FISH = ['🐟', '🐠', '🐡', '🦀', '🦐'];
function startFishing() {
  if (fishing || !player) return;
  if (Math.hypot(player.position.x - POND.x, player.position.z - POND.z) > 7.5) { questToast('Get closer to the pond to fish! 🎣'); return; }
  const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff5a5a }));
  const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
  bobber.position.set(POND.x + Math.cos(a) * r, 0.35, POND.z + Math.sin(a) * r);
  scene.add(bobber);
  fishing = { bobber, until: timer.getElapsed() + 2 + Math.random() * 3, base: bobber.position.y };
  questToast('Casting… 🎣 wait for a bite!');
}
function updateFishing(t) {
  if (!fishing) return;
  fishing.bobber.position.y = fishing.base + Math.sin(t * 4) * 0.05;
  if (t >= fishing.until) {
    const fish = FISH[Math.floor(Math.random() * FISH.length)], value = 2 + Math.floor(Math.random() * 2);
    addProduce(value); if (typeof onFishCaught === 'function') onFishCaught();
    questToast(`Caught a ${fish}! Sell it at 🏪 THE STORE`);
    if (typeof playDing === 'function') playDing();
    scene.remove(fishing.bobber); fishing = null;
  }
}

// ---- Animal helper side quest ----
let sideQuest = null, nextSideQuestAt = 25;
const LOST_ITEMS = ['🧦', '👒', '🧤', '🎀', '🧣', '👟', '🧢'];
const _spDir = new THREE.Vector3();
function startSideQuest(t) {
  const emoji = LOST_ITEMS[Math.floor(Math.random() * LOST_ITEMS.length)];
  // a cute forest animal comes out asking for help
  const sprite = FOREST_ANIMALS[Math.floor(Math.random() * FOREST_ANIMALS.length)].sprite;
  const tex = textureLoader.load(`./assets/characters/${sprite}`); tex.colorSpace = THREE.SRGBColorSpace;
  const animal = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  animal.position.set(FOREST.x - 9, 1.3, FOREST.z - 2);
  scene.add(animal);
  const ask = makeEmojiSprite('❓'); ask.position.set(0, 1.9, 0); ask.visible = true; animal.add(ask);
  // the lost item somewhere reachable
  const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 22;
  const item = makeEmojiSprite(emoji); item.visible = true; item.scale.set(1.4, 1.4, 1);
  item.position.set(Math.cos(a) * r, 1.3, Math.sin(a) * r);
  scene.add(item);
  sideQuest = { emoji, animal, item };
  questToast(`An animal lost their ${emoji} — go find it!`);
  if (questOpen) refreshQuests();
}
function updateSideQuests(t) {
  if (!sideQuest) { if (player && t > nextSideQuestAt) startSideQuest(t); return; }
  // bob the lost item; the animal faces the camera
  sideQuest.item.position.y = 1.3 + Math.sin(t * 2) * 0.18;
  sideQuest.animal.rotation.y = Math.atan2(camera.position.x - sideQuest.animal.position.x, camera.position.z - sideQuest.animal.position.z);
  if (player) {
    const d = Math.hypot(player.position.x - sideQuest.item.position.x, player.position.z - sideQuest.item.position.z);
    if (d < 2.4) { // found it!
      scene.remove(sideQuest.item); scene.remove(sideQuest.animal);
      addStars(8); questToast(`You found the lost ${sideQuest.emoji}! +8 ✨`);
      sideQuest = null; nextSideQuestAt = t + 55 + Math.random() * 30;
      if (questOpen) refreshQuests();
    }
  }
}

buildQuestPanel();
buildPuzzle();

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
let shopEl = null, shopOpen = false, shopMsgEl = null, ownedEl = null, sellRow = null;
const shopRows = [];

function buildShop() {
  shopEl = document.createElement('div');
  shopEl.id = 'shop';
  shopEl.style.display = 'none';
  const h = document.createElement('h3');
  h.append('🏪 THE STORE');
  const sub = document.createElement('p');
  sub.className = 'shop-sub';
  sub.textContent = 'Pay with 🪙 coins!';
  const list = document.createElement('div');
  list.className = 'shop-list';
  SHOP_ITEMS.forEach((item) => {
    const row = document.createElement('button');
    row.className = 'shop-item';
    const lbl = document.createElement('span');
    lbl.textContent = `${item.emoji} ${item.name}`;
    const price = document.createElement('span');
    price.className = 'shop-price';
    price.textContent = `${item.price} 🪙`;
    row.append(lbl, price);
    row.addEventListener('click', () => buyItem(item));
    list.appendChild(row);
    shopRows.push({ item, row });
  });
  // Sell-your-harvest button (crops & fish → coins + ✨ stars to level up)
  sellRow = document.createElement('button');
  sellRow.className = 'shop-item';
  sellRow.style.background = 'rgba(127,255,209,.12)';
  sellRow.addEventListener('click', () => {
    if (bagCount <= 0) { shopMsgEl.textContent = 'Catch fish 🎣 or grow crops 🥕 first!'; return; }
    const n = bagCount, c = sellProduce();
    shopMsgEl.textContent = `Sold ${n} 🥕🐟 for ${c} 🪙 + ✨!`;
    animate(shopMsgEl, { scale: [1.2, 1], opacity: [0.4, 1], duration: 300, ease: 'out(3)' });
  });
  shopMsgEl = document.createElement('p');
  shopMsgEl.className = 'shop-msg';
  ownedEl = document.createElement('p');
  ownedEl.className = 'shop-owned';
  shopEl.append(h, sub, list, sellRow, shopMsgEl, ownedEl);
  refreshSell();
  document.body.appendChild(shopEl);
}
function refreshSell() {
  if (!sellRow) return;
  sellRow.replaceChildren();
  const lbl = document.createElement('span'); lbl.textContent = `💰 Sell crops & fish (${bagCount})`;
  const v = document.createElement('span'); v.className = 'shop-price'; v.textContent = bagCount ? `+${bagValue} 🪙 +✨` : '—';
  sellRow.append(lbl, v);
}

function refreshShop() {
  shopRows.forEach(({ item, row }) => {
    row.classList.toggle('cant-afford', coins < item.price);
  });
}

function updateOwned() {
  const have = Object.entries(owned).filter(([, n]) => n > 0);
  if (!have.length) { ownedEl.textContent = ''; return; }
  const icons = SHOP_ITEMS.filter((i) => owned[i.name]).map((i) => i.emoji.repeat(owned[i.name])).join(' ');
  ownedEl.textContent = 'Yours: ' + icons;
}

function buyItem(item) {
  if (coins < item.price) {
    shopMsgEl.textContent = `Not enough — you need ${item.price} 🪙!`;
    animate(shopMsgEl, { opacity: [0.3, 1], duration: 220 });
    return;
  }
  addCoins(-item.price);
  owned[item.name] = (owned[item.name] || 0) + 1;
  shopMsgEl.textContent = `You bought ${item.emoji} ${item.name}!`;
  animate(shopMsgEl, { scale: [1.2, 1], opacity: [0.4, 1], duration: 300, ease: 'out(3)' });
  updateOwned();
  refreshShop();
  if (typeof saveGame === 'function') saveGame();
}

function openShop() {
  shopOpen = true;
  refreshShop(); refreshSell();
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

// ---------------------------------------------------------------------------
// 🎁 Prize shop — spend ✨ stars on special items you can actually use.
// ---------------------------------------------------------------------------
const PRIZES = [
  { id: 'speed', emoji: '🏃', name: 'Speed Boots', cost: 12, desc: 'Move faster' },
  { id: 'magnet', emoji: '🧲', name: 'Coin Magnet', cost: 16, desc: 'Pull in nearby coins' },
  { id: 'lucky', emoji: '🍀', name: 'Lucky Clover', cost: 18, desc: 'Sell produce for 2×' },
  { id: 'lantern', emoji: '🔦', name: 'Lantern', cost: 14, desc: 'A light that follows you' },
  { id: 'power', emoji: '💪', name: 'Power Crystal', cost: 22, desc: '+6 battle strength' },
];
let prizeEl = null, prizeOpen = false, prizeListEl = null, prizeBalEl = null;
function buildPrizes() {
  prizeEl = document.createElement('div'); prizeEl.id = 'prizepanel'; prizeEl.style.display = 'none';
  const h = document.createElement('h3'); h.append('🎁 Prizes');
  prizeBalEl = document.createElement('p'); prizeBalEl.className = 'shop-sub';
  prizeListEl = document.createElement('div'); prizeListEl.className = 'shop-list';
  const msg = document.createElement('p'); msg.className = 'shop-msg'; prizeEl._msg = msg;
  prizeEl.append(h, prizeBalEl, prizeListEl, msg);
  document.body.appendChild(prizeEl); refreshPrizes();
}
function refreshPrizes() {
  if (!prizeListEl) return;
  if (prizeBalEl) prizeBalEl.textContent = `You have ${starBalance} ⭐ to spend`;
  prizeListEl.replaceChildren();
  PRIZES.forEach((p) => {
    const row = document.createElement('button'); row.className = 'shop-item'; if (prizes[p.id]) row.classList.add('worn');
    const lbl = document.createElement('span'); lbl.textContent = `${p.emoji} ${p.name} — ${p.desc}`;
    const price = document.createElement('span'); price.className = 'shop-price'; price.textContent = prizes[p.id] ? '✓ owned' : `${p.cost} ⭐`;
    row.append(lbl, price);
    if (!prizes[p.id]) row.addEventListener('click', () => buyPrize(p));
    prizeListEl.appendChild(row);
  });
}
function buyPrize(p) {
  if (prizes[p.id]) return;
  if (starBalance < p.cost) { prizeEl._msg.textContent = `Need ${p.cost} ⭐ — earn more from quests!`; return; }
  starBalance -= p.cost; prizes[p.id] = true; applyPrizeEffects();
  prizeEl._msg.textContent = `Got ${p.emoji} ${p.name}!`; if (typeof playDing === 'function') playDing();
  refreshPrizes(); if (typeof saveGame === 'function') saveGame();
}
function openPrizes() { if (typeof questOpen !== 'undefined' && questOpen) closeQuests(); if (typeof tradeOpen !== 'undefined' && tradeOpen) closeTrade(); prizeOpen = true; refreshPrizes(); prizeEl.style.display = 'block'; animate(prizeEl, { opacity: [0, 1], duration: 240, ease: 'out(3)' }); }
function closePrizes() { prizeOpen = false; animate(prizeEl, { opacity: [1, 0], duration: 200, onComplete: () => { prizeEl.style.display = 'none'; } }); }
buildPrizes();
const lanternLight = new THREE.PointLight(0xfff0c0, 0, 16, 1.6); scene.add(lanternLight);

// ---------------------------------------------------------------------------
// ⚔️ Enemies & battles — optional fights that make your character stronger.
// ---------------------------------------------------------------------------
const ENEMIES = [
  { id: 'slime', sprite: 'slime.png', name: 'Slime', hp: 22, atk: 4, reward: 6 },
  { id: 'goblin', sprite: 'goblin.png', name: 'Goblin', hp: 36, atk: 6, reward: 9 },
  { id: 'bat', sprite: 'bat.png', name: 'Bat', hp: 28, atk: 5, reward: 8 },
];
const BOSS = { id: 'boss', sprite: 'boss.png', name: 'Big Boss Dragon', hp: 90, atk: 9, reward: 25, boss: true };
const enemies = [];
const ENEMY_AREA = { x: 34, z: -18 };
function spawnEnemies() {
  ENEMIES.forEach((e, i) => {
    const a = (i / ENEMIES.length) * Math.PI * 2;
    const h = spawnCritter({ sprite: e.sprite, name: e.name, lines: ['Grr!', 'Wanna battle?', 'Rawr!'], scale: 0.85, center: ENEMY_AREA, radius: 7, x: ENEMY_AREA.x + Math.cos(a) * 4, z: ENEMY_AREA.z + Math.sin(a) * 4 });
    h.userData.isEnemy = true; h.userData.enemy = e; enemies.push(h);
  });
  // the BIG BOSS — bigger and much tougher, stands alone at the back of the battle area
  const b = spawnCritter({ sprite: BOSS.sprite, name: BOSS.name, lines: ['ROAAR!', 'Face me if you dare!', 'GRRRAH!'], scale: 1.9, center: { x: ENEMY_AREA.x, z: ENEMY_AREA.z - 13 }, radius: 1.5, x: ENEMY_AREA.x, z: ENEMY_AREA.z - 13 });
  b.userData.isEnemy = true; b.userData.enemy = BOSS; enemies.push(b);
  const sign = makeSign('BATTLE!'); sign.scale.setScalar(0.55); sign.position.set(ENEMY_AREA.x, 2.8, ENEMY_AREA.z + 8); scene.add(sign);
  const bossSign = makeSign('BOSS'); bossSign.scale.setScalar(0.5); bossSign.position.set(ENEMY_AREA.x, 3.4, ENEMY_AREA.z - 18); scene.add(bossSign);
  noTreeZones.push({ x: ENEMY_AREA.x, z: ENEMY_AREA.z - 4, r: 16 });
}

let battlePromptEl = null, battlePromptFor = null, battlePromptCool = 0;
function buildBattlePrompt() {
  battlePromptEl = document.createElement('div'); battlePromptEl.id = 'battleprompt'; battlePromptEl.style.display = 'none';
  const txt = document.createElement('span'); battlePromptEl._txt = txt;
  const fight = document.createElement('button'); fight.className = 'bp-btn fight'; fight.textContent = '⚔️ Fight';
  fight.addEventListener('click', () => { const e = battlePromptFor; hideBattlePrompt(); if (e) openBattle(e); });
  const run = document.createElement('button'); run.className = 'bp-btn'; run.textContent = '🏃 No thanks';
  run.addEventListener('click', () => { battlePromptCool = timer.getElapsed() + 6; hideBattlePrompt(); });
  battlePromptEl.append(txt, fight, run); document.body.appendChild(battlePromptEl);
}
function showBattlePrompt(holder) { battlePromptFor = holder; battlePromptEl._txt.textContent = `A wild ${holder.userData.enemy.name} appears! `; battlePromptEl.style.display = 'flex'; }
function hideBattlePrompt() { battlePromptFor = null; if (battlePromptEl) battlePromptEl.style.display = 'none'; }
function updateEnemies(t) {
  if (!player || battleActive) { hideBattlePrompt(); return; }
  if (t < battlePromptCool) return;
  let near = null, nd = 4;
  for (const h of enemies) {
    if (h.userData.defeatedUntil && t < h.userData.defeatedUntil) continue;
    const d = Math.hypot(player.position.x - h.position.x, player.position.z - h.position.z);
    if (d < nd) { nd = d; near = h; }
  }
  if (near && battlePromptFor !== near) showBattlePrompt(near);
  else if (!near && battlePromptFor) hideBattlePrompt();
}

let battleEl = null, battleActive = false, battleState = null;
function buildBattle() {
  battleEl = document.createElement('div'); battleEl.id = 'battle'; battleEl.className = 'gamemodal'; battleEl.style.display = 'none';
  const panel = document.createElement('div'); panel.className = 'puzzle-panel';
  const h = document.createElement('h3'); h.textContent = '⚔️ Battle'; battleEl._title = h;
  const eName = document.createElement('p'); eName.className = 'battle-name'; battleEl._eName = eName;
  const eBar = document.createElement('div'); eBar.className = 'hpbar'; const eFill = document.createElement('div'); eFill.className = 'hpfill enemy'; eBar.appendChild(eFill); battleEl._eFill = eFill;
  const img = document.createElement('img'); img.className = 'battle-sprite'; battleEl._img = img;
  const pName = document.createElement('p'); pName.className = 'battle-name'; pName.textContent = '🦸 You'; battleEl._pName = pName;
  const pBar = document.createElement('div'); pBar.className = 'hpbar'; const pFill = document.createElement('div'); pFill.className = 'hpfill'; pBar.appendChild(pFill); battleEl._pFill = pFill;
  const msg = document.createElement('p'); msg.className = 'puzzle-msg'; battleEl._msg = msg;
  const atk = document.createElement('button'); atk.className = 'puzzle-close'; atk.style.background = '#e0556a'; atk.textContent = '⚔️ Attack!'; atk.addEventListener('click', battleAttack); battleEl._atk = atk;
  const run = document.createElement('button'); run.className = 'puzzle-close'; run.textContent = '🏃 Run away'; run.addEventListener('click', () => { battleActive = false; battleEl.style.display = 'none'; });
  panel.append(h, eName, eBar, img, pName, pBar, msg, atk, run);
  battleEl.appendChild(panel); document.body.appendChild(battleEl);
}
function openBattle(holder) {
  if (!battleEl) buildBattle();
  const e = holder.userData.enemy, mhp = playerMaxHp();
  battleState = { holder, e, eHp: e.hp, eMax: e.hp, pHp: mhp, pMax: mhp, busy: false };
  battleActive = true;
  battleEl._title.textContent = `⚔️ Battle: ${e.name}`;
  battleEl._eName.textContent = `👾 ${e.name}`;
  battleEl._img.src = `./assets/characters/${e.sprite}`;
  battleEl._msg.textContent = 'Tap Attack! 💥';
  battleEl._atk.disabled = false;
  renderBattle(); battleEl.style.display = 'flex';
}
function renderBattle() {
  const s = battleState; if (!s) return;
  battleEl._eFill.style.width = Math.max(0, s.eHp / s.eMax * 100) + '%';
  battleEl._pFill.style.width = Math.max(0, s.pHp / s.pMax * 100) + '%';
}
function battleAttack() {
  const s = battleState; if (!s || s.busy) return;
  s.busy = true; battleEl._atk.disabled = true;
  const dmg = Math.max(1, playerAtk() + Math.floor(Math.random() * 5) - 2);
  s.eHp -= dmg; renderBattle(); battleEl._msg.textContent = `You hit ${s.e.name} for ${dmg}! 💥`;
  if (s.eHp <= 0) { setTimeout(battleWin, 700); return; }
  setTimeout(() => {
    const edmg = s.e.atk + Math.floor(Math.random() * 3);
    s.pHp -= edmg; renderBattle(); battleEl._msg.textContent = `${s.e.name} hits back for ${edmg}!`;
    if (s.pHp <= 0) { setTimeout(battleLose, 700); return; }
    s.busy = false; battleEl._atk.disabled = false;
  }, 700);
}
function battleWin() {
  const s = battleState;
  battleEl._msg.textContent = `You won! +${s.e.reward} ✨ — you got stronger! 💪`;
  addStars(s.e.reward); addCoins(3); battleWins += 1; applyPrizeEffects();
  s.holder.userData.defeatedUntil = timer.getElapsed() + 30; s.holder.visible = false;
  setTimeout(() => { if (s.holder) s.holder.visible = true; }, 30000);
  battleActive = false; setTimeout(() => { battleEl.style.display = 'none'; }, 1700);
  if (typeof saveGame === 'function') saveGame();
}
function battleLose() {
  battleEl._msg.textContent = `You fainted! Level up & try again. 💫`;
  battleActive = false; setTimeout(() => { battleEl.style.display = 'none'; }, 1700);
}
buildBattlePrompt(); buildBattle();

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
  noTreeZones.push({ x: DRESS_CENTER.x, z: DRESS_CENTER.z, r: 9 });
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

// Party balloons tied to the houses.
const PARTY_COLORS = [0xff5a5a, 0x6aa6ff, 0xffe066, 0x74e08c, 0xff7eb6, 0xb18cff];
const balloonBunches = [];
function makeBalloonBunch() {
  const g = new THREE.Group();
  const stringMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const color = PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 });
    const ox = (i - 1) * 0.45, oy = 1.7 + Math.random() * 0.4, oz = (Math.random() - 0.5) * 0.4;
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), mat);
    balloon.scale.set(1, 1.25, 1); balloon.position.set(ox, oy, oz); g.add(balloon);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 6), mat);
    knot.position.set(ox, oy - 0.42, oz); g.add(knot);
    // string from the knot down to the tie point at the origin
    const end = new THREE.Vector3(ox, oy - 0.45, oz);
    const len = end.length();
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4), stringMat);
    str.position.copy(end.clone().multiplyScalar(0.5));
    str.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().normalize());
    g.add(str);
  }
  return g;
}
function updateBalloons(t) {
  for (const b of balloonBunches) {
    b.g.position.y = b.baseY + Math.sin(t * 0.9 + b.phase) * 0.12;
    b.g.rotation.z = Math.sin(t * 0.7 + b.phase) * 0.09;
  }
}

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

  // party balloons tied by the front door
  const bunch = makeBalloonBunch();
  bunch.position.set(W / 2 - 0.4, H1 - 0.3, D / 2 - 0.1);
  g.add(bunch);
  balloonBunches.push({ g: bunch, phase: Math.random() * Math.PI * 2, baseY: bunch.position.y });

  g.position.set(x, 0, z);
  g.rotation.y = rotationY;
  scene.add(g);
  houses.push({ x, z, ry: rotationY });
  noTreeZones.push({ x, z, r: 5.5 });

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
const doghouseSpotById = {};                           // char id -> spot beside the house for the doghouse
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
    // doghouse spot: in front of the house door (toward the courtyard) and to one side
    const px = -sn, pz = cs; // perpendicular to the radial direction
    doghouseSpotById[c.id] = { x: cs * (R - 4) + px * 2.6, z: sn * (R - 4) + pz * 2.6 };
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
const DAY_LENGTH = 560;   // seconds for one full day (long, so it doesn't get dark too fast)
const DAY_START = 0.18;   // start mid-morning so it's bright on load
let isNight = false;
const phaseEl = document.getElementById('timephase');

// Moon + soft moonlight that appear at night (opposite the sun).
const moon = new THREE.Mesh(new THREE.SphereGeometry(42, 24, 18), new THREE.MeshBasicMaterial({ color: 0xeef0ff }));
moon.visible = false; scene.add(moon);
moon.add(new THREE.Mesh(new THREE.SphereGeometry(64, 20, 16), new THREE.MeshBasicMaterial({ color: 0xaab4ff, transparent: true, opacity: 0.22, depthWrite: false })));
const moonLight = new THREE.DirectionalLight(0x9fb4ff, 0); // cool moonlight
scene.add(moonLight); scene.add(moonLight.target);
const _moonDir = new THREE.Vector3();
const _moonTint = new THREE.Color(0x9fb6e8); // cool tint the moon ambient lerps toward

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
  // biased so daytime is a long bright plateau and night is shorter (gets dark slower)
  const dayness = Math.max(0, Math.min(1, sinE * 1.7 + 0.5)); // 0 deep night … 1 high noon
  sunLight.intensity = 0.1 + dayness * 0.75; // sun softened to ~60% (less bright)
  hemi.intensity = 0.2 + dayness * 0.5;
  // keep daytime exposure modest so the sky shows its blue and white sprites
  // (like Boo) don't blow out; night stays a touch brighter for playability.
  renderer.toneMappingExposure = 0.5 + dayness * 0.24;
  scene.fog.color.copy(_nightFog).lerp(_dayFog, dayness);
  starMat.opacity = Math.max(0, 1 - dayness * 3);
  isNight = dayness < 0.12;
  // moon: opposite the sun, rises at night and casts soft moonlight
  const moonPhi = (90 - (-75 * sinE)) * Math.PI / 180;
  const moonAz = (70 + dayT * 220 + 180) * Math.PI / 180;
  _moonDir.setFromSphericalCoords(1, moonPhi, moonAz);
  moon.position.copy(_moonDir).multiplyScalar(1300);
  const moonUp = Math.max(0, Math.min(1, (0.18 - dayness) * 6)); // only at deep night (matches the lamps)
  moon.visible = moonUp > 0.02;
  moonLight.position.copy(_moonDir).multiplyScalar(100);
  moonLight.intensity = moonUp * 0.5;    // gentle directional moonlight
  // soft moonlit ambient so the WHOLE place is lit at night (kept modest)
  hemi.intensity += moonUp * 0.45;
  hemi.color.setHex(0xcfe8ff).lerp(_moonTint, moonUp * 0.6); // cool moonlit tint at night
  // lamp posts glow & cast light at night
  const lampOn = Math.max(0, 1 - dayness * 2.4);
  for (const lp of lampPosts) lp.orbMat.emissiveIntensity = 0.2 + lampOn * 3.2; // every orb glows brightly (free)
  // and the shared point-light pool follows the lamps nearest the camera
  if (lampOn > 0.01 && lampPosts.length) {
    const cx = controls.target.x, cz = controls.target.z;
    const nearest = lampPosts
      .map((lp) => ({ lp, d: (lp.x - cx) ** 2 + (lp.z - cz) ** 2 }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < lampLightPool.length; i++) {
      const l = lampLightPool[i];
      if (i < nearest.length) { l.position.set(nearest[i].lp.x, 2.95, nearest[i].lp.z); l.intensity = lampOn * 6.5; }
      else l.intensity = 0;
    }
  } else {
    for (const l of lampLightPool) l.intensity = 0;
  }
  hemi.intensity += lampOn * 0.18; // gentle ambient lift so the whole place reads as lit at night
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
// A more bird-like model: tapered body, head, beak, tail, and two-segment
// wings that flap from the shoulder with a bent tip.
// ---------------------------------------------------------------------------
// Weather: sometimes sunny, sometimes rainy. Rain darkens the sky a little and
// the roaming characters put up umbrellas.
// ---------------------------------------------------------------------------
let weather = 'sunny', rainAmt = 0, nextWeatherAt = 30;
const RAIN_N = 1400;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 3);
const rainVel = new Float32Array(RAIN_N);
for (let i = 0; i < RAIN_N; i++) {
  rainPos[i * 3] = (Math.random() - 0.5) * 64;
  rainPos[i * 3 + 1] = Math.random() * 30;
  rainPos[i * 3 + 2] = (Math.random() - 0.5) * 64;
  rainVel[i] = 20 + Math.random() * 12;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.PointsMaterial({ color: 0xbcd6ff, size: 0.45, transparent: true, opacity: 0, depthWrite: false });
const rain = new THREE.Points(rainGeo, rainMat);
rain.frustumCulled = false; scene.add(rain);
const _rainGray = new THREE.Color(0x6b7686);
function updateWeather(t, dt) {
  if (t > nextWeatherAt) { weather = weather === 'sunny' ? 'rainy' : 'sunny'; nextWeatherAt = t + 35 + Math.random() * 45; }
  rainAmt += ((weather === 'rainy' ? 1 : 0) - rainAmt) * Math.min(1, dt * 0.5);
  rainMat.opacity = rainAmt * 0.85;
  rain.visible = rainAmt > 0.02;
  if (rain.visible) {
    rain.position.set(controls.target.x, 0, controls.target.z); // rain follows your view
    const p = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_N; i++) {
      p[i * 3 + 1] -= rainVel[i] * dt;
      if (p[i * 3 + 1] < 0) { p[i * 3 + 1] = 26 + Math.random() * 6; p[i * 3] = (Math.random() - 0.5) * 64; p[i * 3 + 2] = (Math.random() - 0.5) * 64; }
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  // gray & darken a little while raining
  renderer.toneMappingExposure *= (1 - rainAmt * 0.28);
  scene.fog.color.lerp(_rainGray, rainAmt * 0.55);
  // characters put up umbrellas
  for (const b of billboards) { const um = b.parent.userData.umbrella; if (um) um.visible = rainAmt > 0.4; }
}

// Puddles that appear when it rains — walk through one to splash!
const puddles = [];
function buildPuddles() {
  let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 5 + rnd() * 32;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.8 + rnd() * 0.7, 20), new THREE.MeshStandardMaterial({ color: 0x6aa6d8, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z); m.visible = false; scene.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 22), new THREE.MeshBasicMaterial({ color: 0xdaf0ff, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.09, z); ring.visible = false; scene.add(ring);
    puddles.push({ mesh: m, ring, x, z, splashAt: 0, ringT: 0 });
  }
}
function updatePuddles(t) {
  for (const p of puddles) {
    const op = Math.min(0.62, rainAmt * 0.62);
    p.mesh.material.opacity = op; p.mesh.visible = rainAmt > 0.05;
    if (player && rainAmt > 0.4 && t > p.splashAt && player.userData.moving) {
      if (Math.hypot(player.position.x - p.x, player.position.z - p.z) < 1.1) {
        p.splashAt = t + 0.5; p.ring.visible = true; p.ringT = t; playSplash();
      }
    }
    if (p.ring.visible) {
      const k = (t - p.ringT) / 0.5;
      if (k >= 1) p.ring.visible = false;
      else { p.ring.scale.setScalar(1 + k * 3.2); p.ring.material.opacity = (1 - k) * 0.7; }
    }
  }
}
buildPuddles();

const birds = [];
function createBirds() {
  const colors = [0x5a6e8c, 0x6f5a86, 0x8c5a5a, 0x4a4f5a, 0x6a8c5a, 0x8c7a5a]; // natural bird tones
  for (let i = 0; i < 8; i++) {
    const color = colors[i % colors.length];
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xe6a23b, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat);
    body.scale.set(0.8, 0.8, 1.9); g.add(body);                       // tapered body
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat);
    head.position.set(0, 0.06, 0.28); g.add(head);                   // head
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), beakMat);
    beak.position.set(0, 0.05, 0.42); beak.rotation.x = Math.PI / 2; g.add(beak);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 4), mat);
    tail.position.set(0, 0, -0.42); tail.rotation.x = -Math.PI / 2; tail.scale.set(1, 1, 0.3); g.add(tail);

    // two-segment wings (inner from shoulder, outer feather tip)
    const wings = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.13, 0.04, 0);
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), mat);
      inner.position.x = side * 0.21; shoulder.add(inner);
      const tip = new THREE.Group(); tip.position.x = side * 0.42; shoulder.add(tip);
      const outer = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.24), mat);
      outer.position.x = side * 0.2; tip.add(outer);
      g.add(shoulder);
      wings.push({ side, shoulder, tip });
    }

    g.userData = {
      wings,
      radius: 14 + Math.random() * 18,
      height: 14 + Math.random() * 9,
      speed: (0.1 + Math.random() * 0.16) * (Math.random() < 0.5 ? 1 : -1),
      phase: Math.random() * Math.PI * 2,
      flap: 5 + Math.random() * 3,
    };
    g.scale.setScalar(1.0 + Math.random() * 0.4);
    scene.add(g);
    birds.push(g);
  }
}
createBirds();
const _birdNext = new THREE.Vector3();
function birdPos(u, tt, out) {
  const ang = u.phase + tt * u.speed;
  const driftX = Math.sin(tt * 0.13 + u.phase) * 7;       // wander so paths aren't perfect circles
  const driftZ = Math.cos(tt * 0.11 + u.phase * 1.3) * 7;
  const climb = Math.sin(tt * 0.5 + u.phase) * 1.4;
  out.set(Math.cos(ang) * u.radius + driftX, u.height + climb, Math.sin(ang) * u.radius + driftZ);
  return out;
}
function updateBirds(t) {
  for (const b of birds) {
    const u = b.userData;
    birdPos(u, t, b.position);
    birdPos(u, t + 0.12, _birdNext);
    b.lookAt(_birdNext);                                   // face the real travel direction
    b.rotateZ(-Math.sin(t * 0.5 + u.phase) * 0.16);        // bank into turns
    // flap: shoulder up/down, wing-tip lags for a natural bend
    const flap = Math.sin(t * u.flap + u.phase);
    for (const w of u.wings) {
      w.shoulder.rotation.z = -w.side * flap * 0.7;
      w.tip.rotation.z = -w.side * Math.sin(t * u.flap + u.phase - 0.6) * 0.5;
    }
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
  if (typeof saveGame === 'function') saveGame();
}
function takeOffItem(charMesh, item) {
  const m = charMesh && charMesh.userData.accessories[item.id];
  if (m) { charMesh.remove(m); delete charMesh.userData.accessories[item.id]; }
  if (typeof saveGame === 'function') saveGame();
}
function recolorItem(charMesh, item, hex) {
  charMesh.userData.itemColors[item.id] = hex;
  const m = charMesh.userData.accessories[item.id];
  if (m) m.material.color.set(hex);
  if (typeof saveGame === 'function') saveGame();
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
      action.textContent = `Buy ${item.price} 🪙`;
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
  if (coins < item.price) {
    dressMsgEl.textContent = `Not enough — you need ${item.price} 🪙!`;
    animate(dressMsgEl, { opacity: [0.3, 1], duration: 220 });
    return;
  }
  addCoins(-item.price);
  itemOwned[item.id] = true;
  wearItem(player && player.userData.mesh, item); // put it on right away
  dressMsgEl.textContent = `You got the ${item.emoji} ${item.name}!`;
  animate(dressMsgEl, { scale: [1.2, 1], opacity: [0.4, 1], duration: 300, ease: 'out(3)' });
  refreshDress();
  if (typeof saveGame === 'function') saveGame();
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

// --- Adaptive quality -------------------------------------------------------
// The perf monitor watches FPS; if the device can't keep up we step quality
// down (pixel ratio, then bloom), and back up when there's headroom. This is
// how the game "adjusts from there" to whatever hardware it's running on.
const QUALITY_LEVELS = [
  { dpr: 1.0, bloom: false },                                     // 0 — low
  { dpr: 1.0, bloom: true },                                      // 1 — medium
  { dpr: Math.min(window.devicePixelRatio, 1.5), bloom: true },   // 2 — high
];
let qualityLevel = QUALITY_LEVELS.length - 1;
let qBadLevel = QUALITY_LEVELS.length; // lowest level that proved too slow (sticky ceiling)
let _qHold = 4; // let first-load asset hitches pass before adjusting
function applyQuality() {
  const q = QUALITY_LEVELS[qualityLevel];
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(q.dpr);
  renderer.setSize(w, h);
  composer.setSize(w * q.dpr, h * q.dpr); // scene/bloom render at the chosen resolution
  bloom.enabled = q.bloom;
}
function adaptiveQuality() {
  if (_qHold > 0) { _qHold--; return; }
  if (PERF.fps && PERF.fps < 30 && qualityLevel > 0) {
    qBadLevel = Math.min(qBadLevel, qualityLevel); // remember this level is too slow
    qualityLevel--; applyQuality(); _qHold = 3;
  } else if (PERF.fps > 55 && qualityLevel + 1 < qBadLevel) { // only climb back to a level that wasn't too slow
    qualityLevel++; applyQuality(); _qHold = 6;
  }
}
applyQuality();

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
  if (typeof miniGameActive === 'function' && miniGameActive()) return; // let the open mini-game take the keys
  if (MOVE_KEYS[e.code]) { keys.add(MOVE_KEYS[e.code]); e.preventDefault(); }
  if (e.code === 'Space') { e.preventDefault(); throwBall(); } // throw the ball for the dog
});
window.addEventListener('keyup', (e) => {
  if (MOVE_KEYS[e.code]) keys.delete(MOVE_KEYS[e.code]);
});
// Stop drifting if focus leaves the page mid-press.
window.addEventListener('blur', () => keys.clear());

// Throw button (works on touch + desktop)
const throwBtnEl = document.getElementById('throwBtn');
if (throwBtnEl) throwBtnEl.addEventListener('click', throwBall);

// Trading list toggle
const tradeBtnEl = document.getElementById('tradeBtn');
if (tradeBtnEl) tradeBtnEl.addEventListener('click', () => { tradeOpen ? closeTrade() : openTrade(); });
const questBtnEl = document.getElementById('questBtn');
if (questBtnEl) questBtnEl.addEventListener('click', () => { questOpen ? closeQuests() : openQuests(); });
const prizeBtnEl = document.getElementById('prizeBtn');
if (prizeBtnEl) prizeBtnEl.addEventListener('click', () => { prizeOpen ? closePrizes() : openPrizes(); });

// Party music — each click changes the song, then turns it off
const musicBtnEl = document.getElementById('musicBtn');
if (musicBtnEl) musicBtnEl.addEventListener('click', () => {
  const trackName = cycleMusic();
  musicBtnEl.textContent = trackName ? '🎵 ' + trackName : '🔇 Music';
});

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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyQuality(); // re-applies renderer + composer sizing at the current quality level
});

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
let frames = 0, fpsLast = 0;
const fpsEl = document.getElementById('fps');

// --- Performance monitor ----------------------------------------------------
// Tracks FPS, the CPU split (game update vs render), draw calls/triangles, the
// number of lights/programs, and pixel ratio. Read window.__PERF anytime, or
// add ?perf to the URL to get a console log once per second.
const PERF = { fps: 0, ms: 0, upd: 0, ren: 0, calls: 0, tris: 0, progs: 0, geoms: 0, texs: 0, lights: 0, pts: 0, dpr: renderer.getPixelRatio(), quality: 2 };
window.__PERF = PERF;
const PERF_LOG = new URLSearchParams(location.search).has('perf');
let _pFrames = 0, _pUpd = 0, _pRen = 0, _pStart = performance.now();
function perfTick(updMs, renMs) {
  _pFrames++; _pUpd += updMs; _pRen += renMs;
  const now = performance.now();
  const span = now - _pStart;
  if (span < 1000) return;
  PERF.fps = +(_pFrames * 1000 / span).toFixed(1);
  PERF.ms = +(span / _pFrames).toFixed(2);
  PERF.upd = +(_pUpd / _pFrames).toFixed(2);
  PERF.ren = +(_pRen / _pFrames).toFixed(2);
  const ri = renderer.info;
  PERF.calls = ri.render.calls; PERF.tris = ri.render.triangles;
  PERF.progs = ri.programs ? ri.programs.length : 0;
  PERF.geoms = ri.memory.geometries; PERF.texs = ri.memory.textures;
  PERF.dpr = +renderer.getPixelRatio().toFixed(2);
  let nl = 0, np = 0; scene.traverse((o) => { if (o.isLight) { nl++; if (o.isPointLight) np++; } });
  PERF.lights = nl; PERF.pts = np;
  if (typeof qualityLevel !== 'undefined') PERF.quality = qualityLevel;
  if (PERF_LOG) console.log(`[perf] ${PERF.fps}fps ms${PERF.ms} (upd${PERF.upd}/ren${PERF.ren}) | calls${PERF.calls} tris${(PERF.tris / 1000).toFixed(0)}k | lights${nl}(pt${np}) progs${PERF.progs} geo${PERF.geoms} tex${PERF.texs} q${PERF.quality} dpr${PERF.dpr}`);
  _pFrames = 0; _pUpd = 0; _pRen = 0; _pStart = now;
  if (typeof adaptiveQuality === 'function') adaptiveQuality();
}

function tick() {
  const _f0 = performance.now();
  renderer.info.reset(); // count draw calls across all composer passes this frame
  timer.update();
  const t = timer.getElapsed();
  const dt = timer.getDelta();

  crystals.children.forEach((c, i) => {
    c.rotation.y += c.userData.spin * dt;
    c.position.y = c.userData.baseY + Math.sin(t * 1.2 + i) * 0.4;
  });

  updateDayNight(t);
  updateWeather(t, dt);
  updatePuddles(t);
  updateBirds(t);
  updateOwl(t);
  updateCampfire(t);
  updateAmbulance(t);
  updateBall(dt);
  updateDog(t, dt);
  updateDoghouse(dt);
  updateBalloons(t);

  // Move first (player walks / free camera), then update characters' facing & bob.
  if (player) updatePlayer(dt); else updateMovement(dt);

  updateCollectibles(t, dt);
  updateShop();
  updateDress();
  updateTrades(t);
  updateSideQuests(t);
  updateGarden(t);
  updateFishing(t);
  updateEnemies(t);
  // lantern prize: a warm light that follows you (brightest at night)
  if (player) { lanternLight.position.set(player.position.x, 2.4, player.position.z); lanternLight.intensity = prizeLantern ? (isNight ? 5 : 1.5) : 0; }
  if (merryGoRound) merryGoRound.rotation.y += dt * 0.7; // roundabout slowly spins

  // Characters: wander around, face the camera (upright billboard), and bob/hop.
  for (const b of billboards) {
    const holder = b.parent;
    const w = holder.userData;

    // roam toward the current target, then pause and pick a new one.
    // The player-controlled character (and the shopkeeper) skip roaming.
    // updatePlayer() sets the player's position/moving flag instead.
    if (!w.isPlayer && !w.isShopkeeper) {
      w.sleeping = false; w.playing = false;
      const cid = b.userData.char && b.userData.char.id;
      const prevX = holder.position.x, prevZ = holder.position.z;
      const trading = w.tradeUntil && t < w.tradeUntil;
      // anglers stop to fish when they wander up to the pond
      if (w.angler && !w.child && (!w.fishUntil || t >= w.fishUntil)) {
        const nearPond = Math.hypot(holder.position.x - POND.x, holder.position.z - POND.z) < 5.5;
        if (nearPond && Math.random() < 0.012) {
          w.fishUntil = t + 4 + Math.random() * 3;
          if (!w.fishSprite) { w.fishSprite = makeEmojiSprite('🎣'); w.fishSprite.position.set(0, CHAR_HEIGHT * 0.95, 0); holder.add(w.fishSprite); }
        }
      }
      const fishingNpc = w.angler && w.fishUntil && t < w.fishUntil;
      if (w.fishSprite) w.fishSprite.visible = !!fishingNpc;
      if (w.sliding) {
        // whee! slide down the slide
        const k = (t - w.sliding.t0) / w.sliding.dur;
        if (k >= 1) { w.sliding = null; holder.position.y = 0; w.slideCooldown = t + 7; }
        else {
          const f = w.sliding.from;
          holder.position.x = f.x + (SLIDE_BOT.x - f.x) * k;
          holder.position.z = f.z + (SLIDE_BOT.z - f.z) * k;
          holder.position.y = f.y + (SLIDE_BOT.y - f.y) * k;
          w.moving = false; w.playing = true;
        }
      } else if (playAtStations(holder, w, t, dt)) {
        // running between the playground / pet-park activities and playing on each
      } else if (w.child && w.parent) {
        // trail the parent around (and into the park)
        _charDir.set(w.parent.position.x - holder.position.x, 0, w.parent.position.z - holder.position.z);
        const d = _charDir.length();
        if (d > 1.7) { w.moving = true; const step = Math.min(w.speed * 1.4 * dt, d - 1.4); holder.position.x += (_charDir.x / d) * step; holder.position.z += (_charDir.z / d) * step; }
        else { w.moving = false; }
      } else if (trading) {
        w.moving = false; // pause to trade goods
      } else if (fishingNpc) {
        w.moving = false; // pause to fish at the pond
      } else if (isNight && SLEEPERS.has(cid) && homeById[cid]) {
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
      // Boo is the ONLY character who phases through walls — keep everyone
      // else (roaming neighbors, kids, pets, critters) out of the houses.
      if (cid !== 'boo' && !w.sliding) {
        const [rx, rz] = resolveWalls(holder.position.x, holder.position.z, prevX, prevZ);
        holder.position.x = rx; holder.position.z = rz;
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
    // ducks sit low in the water (and gently bob) when they're in the pond
    if (w.swimmer && Math.hypot(holder.position.x - POND.x, holder.position.z - POND.z) < 3.4) {
      b.position.y = b.userData.baseY - 0.55 + Math.sin(t * 2 + b.userData.bobPhase) * 0.07;
    }
    // playing on an activity → excited hop, all in sync so they look like they're playing together
    if (w.playing && !w.moving) b.position.y = b.userData.baseY + Math.abs(Math.sin(t * 7)) * 0.36;

    // show a floating 💤 while sleeping
    if (holder.userData.zzz) {
      holder.userData.zzz.visible = !!w.sleeping;
      if (w.sleeping) holder.userData.zzz.position.y = (CHAR_HEIGHT + 1.0) + Math.sin(t * 2 + b.userData.bobPhase) * 0.12;
    }
    // show the goods emoji while trading
    if (holder.userData.tradeSprite) {
      const trading = w.tradeUntil && t < w.tradeUntil;
      holder.userData.tradeSprite.visible = !!trading;
      if (trading) holder.userData.tradeSprite.position.y = (CHAR_HEIGHT + 0.35) + Math.sin(t * 3 + b.userData.bobPhase) * 0.1;
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
  const _u = performance.now();
  composer.render();
  perfTick(_u - _f0, performance.now() - _u);

  // FPS readout
  frames++;
  if (t - fpsLast >= 0.5) {
    fpsEl.textContent = Math.round(frames / (t - fpsLast)) + ' fps' + (PERF_LOG ? ' q' + qualityLevel : '');
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
