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
// --- Occlusion fade -------------------------------------------------------
// Anything solid that comes between the camera and YOUR character (house
// walls, roofs, trees…) fades to see-through, so you're never invisible
// inside or behind a building. Meshes opt in via registerOccluder().
const occludables = [];
function registerOccluder(mesh) {
  mesh.material = mesh.material.clone(); // per-mesh material so only the blocking pane fades
  mesh.userData.occBase = mesh.material.opacity;
  occludables.push(mesh);
}
const _occRay = new THREE.Raycaster();
const _occAim = new THREE.Vector3();
const _occSide = new THREE.Vector3();
const _occFading = new Set();
function updateOcclusionFade(dt) {
  if (!player) return;
  // three rays — straight at the character plus one to each side — so the
  // whole pane hiding them fades, not just a pin-hole
  _occSide.set(camera.position.x - player.position.x, 0, camera.position.z - player.position.z);
  _occSide.set(-_occSide.z, 0, _occSide.x).normalize(); // camera-perpendicular
  for (const side of [-1.1, 0, 1.1]) {
    _occAim.set(player.position.x + _occSide.x * side, player.position.y + 1.4, player.position.z + _occSide.z * side);
    const dist = camera.position.distanceTo(_occAim);
    _occRay.set(camera.position, _occAim.sub(camera.position).normalize());
    _occRay.near = 0;
    _occRay.far = Math.max(0, dist - 0.4); // stop just short of the character
    for (const h of _occRay.intersectObjects(occludables, false)) {
      h.object.userData.occHidden = true;
      _occFading.add(h.object);
    }
  }
  const k = Math.min(1, dt * 10);
  for (const m of _occFading) {
    const base = m.userData.occBase ?? 1;
    const want = m.userData.occHidden ? 0.15 : base;
    m.material.transparent = true;
    m.material.opacity += (want - m.material.opacity) * k;
    if (!m.userData.occHidden && Math.abs(m.material.opacity - base) < 0.02) {
      m.material.opacity = base;
      m.material.transparent = false;
      _occFading.delete(m);
    }
    m.userData.occHidden = false; // the raycast re-marks it next frame if it still blocks
  }
}

function loadModel(file, { position = [0, 0, 0], rotationY = 0, scale = 1 } = {}) {
  gltfLoader.load(`./assets/models/${file}`, (gltf) => {
    const model = gltf.scene;
    model.position.set(...position);
    model.rotation.y = rotationY;
    model.scale.setScalar(scale);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        if (file.startsWith('tree')) registerOccluder(o); // trees go see-through when they hide you
      }
    });
    scene.add(model);
    // gentle "place down" pop using anime.js
    model.scale.setScalar(scale * 0.001);
    animate(model.scale, { x: scale, y: scale, z: scale, duration: 600, ease: 'out(3)' });
  });
}

const TREE_RING = 7.5; // ring the fountain, tucked INSIDE the ambulance road (r=11) so the van never clips them
loadModel('fountain-round.glb', { position: [0, 0, 0], scale: 2.4 });
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.5;
  const file = i % 2 === 0 ? 'tree-high-round.glb' : 'tree.glb';
  loadModel(file, { position: [Math.cos(a) * TREE_RING, 0, Math.sin(a) * TREE_RING], rotationY: a, scale: 1.9 });
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
// lamps along the path out to the park (the first is pulled inside the ambulance road)
makeLampPost(-8.5, -1.4); makeLampPost(-21, -6);

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
    const zones = [{ x: 0, z: 0, r: 11 }, { x: PARK.x, z: PARK.z, r: 15 }, { x: 0, z: 24, r: 11 }, { x: CAMP.x, z: CAMP.z, r: 11 }, { x: POND.x, z: POND.z, r: 5 }, { x: CAFE.x, z: CAFE.z, r: 6 }];
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
  const x = document.createElement('button'); x.className = 'panel-close'; x.textContent = '✕';
  x.addEventListener('click', () => closeTrade());
  tradeEl.append(x, h, sub, tradeListEl, tradeMsgEl);
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
function openTrade() { if (typeof questOpen !== 'undefined' && questOpen) closeQuests(); if (typeof prizeOpen !== 'undefined' && prizeOpen) closePrizes(); if (typeof shopOpen !== 'undefined' && shopOpen) { shopDismissed = true; closeShop(); } tradeOpen = true; refreshTradePanel(); tradeEl.style.display = 'block'; animate(tradeEl, { opacity: [0, 1], duration: 240, ease: 'out(3)' }); }
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

// true while any full-screen choice modal is up — world input should pause
function uiModalOpen() {
  for (const el of [pickerEl,
    typeof petChoiceEl !== 'undefined' ? petChoiceEl : null,
    typeof petNameEl !== 'undefined' ? petNameEl : null,
    typeof childChoiceEl !== 'undefined' ? childChoiceEl : null]) {
    if (el && el.style.display === 'flex') return true;
  }
  return false;
}

const lockedCardRefs = []; // { card, lockBadge, nm, c } for each locked character — kept fresh by refreshPickerLocks()
let pickerCloseBtn = null;
function buildPicker(roster) {
  pickerEl = document.createElement('div');
  pickerEl.id = 'picker';
  const panel = document.createElement('div');
  panel.className = 'picker-panel';
  // a ✕ so an accidental "Change character" tap is recoverable (hidden until a character exists)
  pickerCloseBtn = document.createElement('button');
  pickerCloseBtn.className = 'panel-close';
  pickerCloseBtn.textContent = '✕';
  pickerCloseBtn.addEventListener('click', () => { if (playerCharId) hidePicker(); });
  panel.appendChild(pickerCloseBtn);
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
      showPetChoice(); // then: choose a pet, then whether you have a child
    });
    grid.appendChild(card);
  };
  // the first six (the original roster) are always available
  roster.forEach((c) => addCard(c.id, c.name, c.sprite));
  // the six neighbors start LOCKED — unlock them one at a time with XP
  (typeof LOCKED_CHARS !== 'undefined' ? LOCKED_CHARS : []).forEach((c) => {
    const card = document.createElement('button');
    card.className = 'picker-card';
    const img = document.createElement('img');
    img.src = `./assets/characters/${c.sprite}`;
    img.alt = c.name;
    const lockBadge = document.createElement('span'); lockBadge.className = 'lock-badge'; lockBadge.textContent = '🔒';
    const nm = document.createElement('span'); nm.className = 'lock-label';
    card.append(img, lockBadge, nm);
    card.addEventListener('click', () => {
      if (performance.now() < pickerReadyAt) return;
      if (isCharUnlocked(c.id)) { playAs(c.id); hidePicker(); showPetChoice(); return; }
      if (totalXP >= c.xpNeeded) {
        unlockedIds.add(c.id);
        if (typeof saveGame === 'function') saveGame();
        if (typeof questToast === 'function') questToast(`🔓 You unlocked ${c.name}!`);
        if (typeof playDing === 'function') playDing();
        refreshPickerLocks();
        playAs(c.id); hidePicker(); showPetChoice();
      } else if (typeof questToast === 'function') {
        questToast(`Need ${c.xpNeeded} XP to unlock ${c.name}! You have ${totalXP} XP so far.`);
      }
    });
    grid.appendChild(card);
    lockedCardRefs.push({ card, lockBadge, nm, c });
  });
  panel.append(h, grid);
  pickerEl.appendChild(panel);
  document.body.appendChild(pickerEl);
  refreshPickerLocks();
}
function refreshPickerLocks() {
  for (const { card, lockBadge, nm, c } of lockedCardRefs) {
    const unlocked = isCharUnlocked(c.id);
    card.classList.toggle('locked', !unlocked);
    lockBadge.style.display = unlocked ? 'none' : '';
    nm.textContent = unlocked ? c.name : `🔒 ${Math.min(totalXP, c.xpNeeded)}/${c.xpNeeded} XP`;
  }
}

function showPicker() {
  if (!pickerEl) return;
  refreshPickerLocks(); // always show current unlock progress
  if (pickerCloseBtn) pickerCloseBtn.style.display = playerCharId ? '' : 'none'; // first pick is mandatory; changes are cancellable
  pickerEl.style.display = 'flex';
  pickerReadyAt = performance.now() + 350; // brief no-click window during fade-in
  animate(pickerEl, { opacity: [0, 1], duration: 280, ease: 'out(3)' });
}
function hidePicker() {
  if (!pickerEl) return;
  animate(pickerEl, { opacity: [1, 0], duration: 220, onComplete: () => { pickerEl.style.display = 'none'; } });
}

// ---- Pet choice: right after picking a character, choose a dog, a cat, or none ----
let petChoiceEl = null, petChoiceReadyAt = 0;
function buildChoiceCard(grid, emoji, label, onPick, readyAtGetter) {
  const card = document.createElement('button');
  card.className = 'picker-card';
  const icon = document.createElement('span'); icon.className = 'emoji-icon'; icon.textContent = emoji;
  const nm = document.createElement('span'); nm.textContent = label;
  card.append(icon, nm);
  card.addEventListener('click', () => { if (performance.now() < readyAtGetter()) return; onPick(); });
  grid.appendChild(card);
}
function buildPetChoice() {
  petChoiceEl = document.createElement('div');
  petChoiceEl.id = 'petchoice'; petChoiceEl.className = 'modal-overlay';
  const panel = document.createElement('div'); panel.className = 'picker-panel';
  const h = document.createElement('h2');
  h.append('Do you want a ', Object.assign(document.createElement('span'), { textContent: 'pet' }), '?');
  const grid = document.createElement('div'); grid.className = 'picker-grid';
  const pick = (kind) => {
    hidePetChoice();
    if (kind === 'none') { applyPetChoice('none'); showChildChoice(); }
    else showPetNamePrompt(kind); // dog/cat: let them name it first
  };
  buildChoiceCard(grid, '🐶', 'A dog!', () => pick('dog'), () => petChoiceReadyAt);
  buildChoiceCard(grid, '🐱', 'A cat!', () => pick('cat'), () => petChoiceReadyAt);
  buildChoiceCard(grid, '🚫', "No pet, that's okay!", () => pick('none'), () => petChoiceReadyAt);
  panel.append(h, grid);
  petChoiceEl.appendChild(panel);
  document.body.appendChild(petChoiceEl);
}
function showPetChoice() {
  if (!petChoiceEl) buildPetChoice();
  petChoiceEl.style.display = 'flex';
  petChoiceReadyAt = performance.now() + 350;
  animate(petChoiceEl, { opacity: [0, 1], duration: 280, ease: 'out(3)' });
}
function hidePetChoice() {
  if (!petChoiceEl) return;
  animate(petChoiceEl, { opacity: [1, 0], duration: 200, onComplete: () => { petChoiceEl.style.display = 'none'; } });
}

// ---- Name your pet: shown right after choosing a dog or cat ----
let petNameEl = null, petNameInput = null, petNameReadyAt = 0, petNameKind = 'dog';
function buildPetNamePrompt() {
  petNameEl = document.createElement('div');
  petNameEl.id = 'petname'; petNameEl.className = 'modal-overlay';
  const panel = document.createElement('div'); panel.className = 'picker-panel';
  const h = document.createElement('h2');
  h.append('Name your ', Object.assign(document.createElement('span'), { textContent: 'pet' }), '!');
  petNameInput = document.createElement('input');
  petNameInput.type = 'text'; petNameInput.maxLength = 12; petNameInput.className = 'name-input';
  petNameInput.autocomplete = 'off';
  petNameInput.enterKeyHint = 'go'; // label the on-screen keyboard's confirm key
  const go = document.createElement('button'); go.className = 'start-btn'; go.textContent = "🐾 Let's go!";
  const confirmName = () => {
    if (performance.now() < petNameReadyAt) return;
    const typed = petNameInput.value.trim().slice(0, 12);
    hidePetNamePrompt();
    applyPetChoice(petNameKind, typed);
    showChildChoice();
  };
  go.addEventListener('click', confirmName);
  petNameInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') confirmName(); });
  panel.append(h, petNameInput, go);
  petNameEl.appendChild(panel);
  document.body.appendChild(petNameEl);
}
function showPetNamePrompt(kind) {
  if (!petNameEl) buildPetNamePrompt();
  petNameKind = kind;
  petNameInput.value = kind === 'cat' ? CAT_NAME : DOG_NAME;
  petNameEl.style.display = 'flex';
  petNameReadyAt = performance.now() + 350;
  animate(petNameEl, { opacity: [0, 1], duration: 280, ease: 'out(3)' });
  setTimeout(() => { petNameInput.focus(); petNameInput.select(); }, 150);
}
function hidePetNamePrompt() {
  if (!petNameEl) return;
  petNameInput.blur();
  animate(petNameEl, { opacity: [1, 0], duration: 200, onComplete: () => { petNameEl.style.display = 'none'; } });
}

// ---- Child choice: then, choose whether you have a child companion ----
let childChoiceEl = null, childChoiceReadyAt = 0;
function buildChildChoice() {
  childChoiceEl = document.createElement('div');
  childChoiceEl.id = 'childchoice'; childChoiceEl.className = 'modal-overlay';
  const panel = document.createElement('div'); panel.className = 'picker-panel';
  const h = document.createElement('h2');
  h.append('Do you have a ', Object.assign(document.createElement('span'), { textContent: 'child' }), '?');
  const grid = document.createElement('div'); grid.className = 'picker-grid cols-2';
  const pick = (want) => { applyChildChoice(want); hideChildChoice(); };
  buildChoiceCard(grid, '👶', 'Yes!', () => pick(true), () => childChoiceReadyAt);
  buildChoiceCard(grid, '🚫', "No, that's okay!", () => pick(false), () => childChoiceReadyAt);
  panel.append(h, grid);
  childChoiceEl.appendChild(panel);
  document.body.appendChild(childChoiceEl);
}
function showChildChoice() {
  if (!childChoiceEl) buildChildChoice();
  childChoiceEl.style.display = 'flex';
  childChoiceReadyAt = performance.now() + 350;
  animate(childChoiceEl, { opacity: [0, 1], duration: 280, ease: 'out(3)' });
}
function hideChildChoice() {
  if (!childChoiceEl) return;
  animate(childChoiceEl, { opacity: [1, 0], duration: 200, onComplete: () => { childChoiceEl.style.display = 'none'; } });
}

// ---- Save / load progress (localStorage) ----
const SAVE_KEY = 'sandyten_save_v1';
let suppressSave = false;
// the player's last-picked Snake fruit & color (persisted); declared up here so
// saveGame/loadGame can reference them safely regardless of module load order
let snakeFruit = '🍎', snakeColorIdx = 0;
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
    const activePet = typeof currentPlayerPet === 'function' ? currentPlayerPet() : null;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ coins, level, levelStars, starBalance, battleWins, prizes, bagCount, bagValue, itemOwned, owned, playerId: playerCharId, petKind, petName: activePet ? activePet.name : '', hasChild, totalXP, unlockedIds: [...unlockedIds], snakeFruit, snakeColorIdx, health, hunger, outfits, questState: (typeof getQuestSave === 'function' ? getQuestSave() : null) }));
  } catch (e) { /* storage unavailable */ }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
function loadGame() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  if (!s) return null;
  suppressSave = true;
  try { // a malformed save must never leave suppressSave stuck on (it would silently disable saving)
    coins = s.coins ?? coins; level = s.level ?? 1; levelStars = s.levelStars ?? 0;
    starBalance = s.starBalance ?? 0; battleWins = s.battleWins ?? 0;
    totalXP = s.totalXP ?? 0;
    if (typeof s.snakeFruit === 'string' && SNAKE_FRUITS.includes(s.snakeFruit)) snakeFruit = s.snakeFruit;
    if (Number.isInteger(s.snakeColorIdx) && s.snakeColorIdx >= 0 && s.snakeColorIdx < SNAKE_COLORS.length) snakeColorIdx = s.snakeColorIdx;
    health = (typeof s.health === 'number' && s.health > 0) ? s.health : 100; // old saves (no stats) start FULL
    hunger = (typeof s.hunger === 'number' && s.hunger > 0) ? s.hunger : 100;
    unlockedIds.clear(); (Array.isArray(s.unlockedIds) ? s.unlockedIds : []).forEach((id) => unlockedIds.add(id));
    // grandfather clause: if you were already playing as a "locked" character
    // before this update, you keep them — you're not suddenly locked out
    if (s.playerId) unlockedIds.add(s.playerId);
    if (typeof refreshPickerLocks === 'function') refreshPickerLocks();
    Object.keys(prizes).forEach((k) => delete prizes[k]); Object.assign(prizes, s.prizes || {});
    if (typeof applyPrizeEffects === 'function') applyPrizeEffects();
    if (typeof refreshPrizes === 'function') refreshPrizes();
    bagCount = s.bagCount ?? 0; bagValue = s.bagValue ?? 0; if (typeof refreshSell === 'function') refreshSell();
    if (typeof resetQuests === 'function') resetQuests(); // your LEVEL is kept, but the quests start fresh each time you play
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
  } catch (e) {
    console.warn('Corrupted save — starting fresh', e);
    s = null; // callers fall back to the character picker
  } finally {
    suppressSave = false;
  }
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
    if (typeof removePlayerPet === 'function') removePlayerPet();
    if (typeof removePlayerKid === 'function') removePlayerKid();
    petKind = 'none'; hasChild = false;
    totalXP = 0; unlockedIds.clear(); if (typeof refreshPickerLocks === 'function') refreshPickerLocks();
    health = 100; hunger = 100; renderStats();
    renderCoins(); renderLevel();
    if (typeof refreshSell === 'function') refreshSell();
    if (typeof refreshPrizes === 'function') refreshPrizes();
    if (typeof resetQuests === 'function') resetQuests();
    hideStartMenu(); showPicker(); // picking a character then asks about a pet & a child
  });
  contBtn.addEventListener('click', () => {
    if (contBtn.disabled || performance.now() < startReadyAt) return;
    let s = null;
    try { s = loadGame(); } catch (e) { console.warn('Continue failed — starting fresh', e); }
    hideStartMenu();
    if (s && s.playerId && holdersById[s.playerId]) {
      playAs(s.playerId);
      // resuming your saved character keeps your pet/child as-is — no re-asking
      if (typeof applyPetChoice === 'function') applyPetChoice(s.petKind || 'none', s.petName || '');
      if (typeof applyChildChoice === 'function') applyChildChoice(!!s.hasChild);
    } else {
      showPicker();
    }
  });
  panel.append(h, sub, newBtn, contBtn);
  startEl.appendChild(panel);
  document.body.appendChild(startEl);
}
function showStartMenu() { if (startEl) { startEl.style.display = 'flex'; startReadyAt = performance.now() + 500; animate(startEl, { opacity: [0, 1], duration: 280, ease: 'out(3)' }); } }
function hideStartMenu() { if (startEl) animate(startEl, { opacity: [1, 0], duration: 220, onComplete: () => { startEl.style.display = 'none'; } }); }

// If a character is standing inside a house, step them just outside its door —
// so taking control of a night-sleeper doesn't start you hidden indoors, and a
// released character isn't stranded pathing against interior walls.
function stepOutsideHouseDoor(holder) {
  for (const h of houses) {
    const [lx, lz] = rotXZ(holder.position.x - h.x, holder.position.z - h.z, -h.ry);
    if (Math.abs(lx) < HOUSE_W / 2 && Math.abs(lz) < HOUSE_D / 2) {
      const [wx, wz] = rotXZ(0, HOUSE_D / 2 + 1.2, h.ry); // just past the doorway
      holder.position.set(h.x + wx, 0, h.z + wz);
      return true;
    }
  }
  return false;
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
    stepOutsideHouseDoor(player);   // if they were indoors, walk them out first
    pickRoamTarget(player);         // give it a fresh place to wander to
  }
  player = holder;
  playerCharId = id;
  holder.position.y = 0;            // start on the ground
  stepOutsideHouseDoor(holder);     // a sleeping character shouldn't start hidden in its house
  holder.userData.isPlayer = true;
  holder.userData.moving = false;
  holder.userData.pauseUntil = Infinity; // never roam while controlled

  // frame the player with a zoomed-out third-person camera
  const p = holder.position;
  controls.target.set(p.x, 1.5, p.z);
  camera.position.set(p.x + 11, 9, p.z + 15);
  controls.minDistance = 2.5; // let kids zoom right in (helps see indoors too)
  controls.maxDistance = 40;
  controls.update();

  const name = holder.children.find((c) => c.userData?.char)?.userData.char.name
    || (window.SANDYTEN.roster.find((r) => r.id === id) || {}).name || 'your character';
  const strong = document.createElement('strong');
  strong.textContent = name;
  const move = document.body.classList.contains('touch') ? 'joystick to move · drag to look' : 'arrow keys / WASD to move · drag to look';
  hintEl.replaceChildren('Playing as ', strong, ' — ' + move);
  changeBtn.style.display = '';
  if (statsEl) statsEl.style.display = 'flex'; // show the health + hunger bars
  renderStats();

  // move Daisy's doghouse next to this character's home
  const spot = (typeof doghouseSpotById !== 'undefined') && doghouseSpotById[id];
  if (spot) doghouseTarget.set(spot.x, 0, spot.z);
  if (typeof saveGame === 'function') saveGame();
}

// Walk around as the chosen character; the camera trails along.
function updatePlayer(dt) {
  if (!player) return;
  const w = player.userData;
  if (typeof uiModalOpen === 'function' && uiModalOpen()) { w.moving = false; return; } // choice modal up — hold still
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
  // vertical: rise/lower with the stairs & loft inside houses. Rate-limited so
  // Boo phasing straight through a wall into the loft zone glides up instead of
  // teleporting 4.3 units in one frame (24 u/s still beats the fastest stair climb)
  const fy = houseFloorHeight(nx, nz);
  const maxStep = 24 * dt;
  const ddy = Math.max(-maxStep, Math.min(maxStep, fy - player.position.y));
  if (Math.abs(ddy) > 1e-4) {
    player.position.y += ddy;
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
  bubbleEl.style.display = 'block'; // …and back again when the speaker returns into view
  bubbleEl.style.left = ((_headPos.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  bubbleEl.style.top = ((-_headPos.y * 0.5 + 0.5) * window.innerHeight) + 'px';
}

// Tap detection: only count it as a click if the pointer barely moved
// (so dragging to look around doesn't trigger a speech bubble).
let downX = 0, downY = 0, downCount = 0, multiTouch = false;
renderer.domElement.addEventListener('pointerdown', (e) => {
  downCount++;
  if (downCount > 1) multiTouch = true; // a pinch-zoom in progress — don't treat either release as a tap
  downX = e.clientX; downY = e.clientY;
});
renderer.domElement.addEventListener('pointercancel', () => { downCount = Math.max(0, downCount - 1); if (downCount === 0) multiTouch = false; });
function clickTargets() {
  let list = billboards;
  if (petDog) list = list.concat(petDog.mesh);
  if (petCat) list = list.concat(petCat.mesh);
  if (gardenSpots.length) {
    list = list.concat(gardenSpots.map((r) => r.mound));
    for (const r of gardenSpots) r.plant.traverse((o) => { if (o.isMesh) list = list.concat(o); }); // the visible crop is tappable too
  }
  if (pondSurface) list = list.concat(pondSurface);
  if (petParkTrigger) list = list.concat(petParkTrigger);
  if (campfireTrigger) list = list.concat(campfireTrigger);
  if (cafeCounter) list = list.concat(cafeCounter);
  // three.js raycasts invisible meshes too, and these two triggers overlap in
  // world space — so only expose the CURRENT floor's trigger
  if (hospCareTrigger && hospCurrentFloor === HOSP_CARE_FLOOR) list = list.concat(hospCareTrigger);
  if (hospNurseryTrigger && hospCurrentFloor === HOSP_FLOORS.length - 1) list = list.concat(hospNurseryTrigger);
  if (telescopeTrigger) list = list.concat(telescopeTrigger);
  return list;
}
renderer.domElement.addEventListener('pointerup', (e) => {
  downCount = Math.max(0, downCount - 1);
  if (multiTouch) { if (downCount === 0) multiTouch = false; return; }
  // wobbly kid fingers get a bigger tap-vs-drag allowance than a mouse does
  const slop = e.pointerType === 'mouse' ? 6 : 18;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > slop) return;
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(clickTargets(), false);
  if (!hits.length) return;
  if (tapBlockedByWall(hits[0])) return; // can't tap someone hidden behind a solid wall
  const obj = hits[0].object;
  if (obj.userData.isPond) {                  // tapped the pond → go fishing
    startFishing();
  } else if (obj.userData.isGarden) {         // tapped a garden plot → plant/harvest
    handleGardenClick(obj);
  } else if (obj.userData.isPetPark) {        // tapped the pet park → your pet goes to play
    startPetPark();
  } else if (obj.userData.isCampfire) {       // tapped the campfire → toast a marshmallow
    toastMarshmallow();
  } else if (obj.userData.isCafe) {           // tapped the cafe counter → free snack, and you eat it
    getCafeFood();
  } else if (obj.userData.isCareBed) {        // care beds (Floor 3) → the doctor checks you up
    careHeal();
  } else if (obj.userData.isNursery) {        // nursery (Floor 4) → rock a baby for a star
    rockBaby();
  } else if (obj.userData.isTelescope) {      // campsite telescope → find pictures in the night sky
    tapTelescope();
  } else if (petDog && obj === petDog.mesh) { // clicked your dog → bark!
    playWoof();
    showBubble(petDog.mesh, petDog.name, 'Woof! 🐶', 1.3);
    petDog.reactUntil = timer.getElapsed() + 0.4; // little excited hop
    if (typeof onPetDog === 'function') onPetDog(); // quest progress
  } else if (petCat && obj === petCat.mesh) { // clicked your cat → purr!
    showBubble(petCat.mesh, petCat.name, 'Purr~ 🐱', 1.1);
    petCat.reactUntil = timer.getElapsed() + 0.4; // little excited hop
    if (typeof onPetDog === 'function') onPetDog(); // quest progress
  } else {
    // walk right up to a friend and tap → share a snack (they eat + say thanks);
    // tap one from across the plaza → they just wave & speak
    const holder = obj.parent;                       // the roaming group
    const char = obj.userData && obj.userData.char;  // char data lives on the billboard mesh
    const isNPC = char && holder && !holder.userData.isPlayer && !holder.userData.isShopkeeper;
    const near = isNPC && player && Math.hypot(player.position.x - holder.position.x, player.position.z - holder.position.z) < 4.5;
    if (near) shareFoodWith(holder, obj, char);
    else showSpeech(obj);
    // petting any other cat/dog around town (neighbors' pets, park cats) counts too
    const holderData = obj.parent && obj.parent.userData;
    if (holderData && holderData.playArea === 'petpark' && typeof onPetDog === 'function') onPetDog();
  }
});

// A tap is blocked when a still-opaque wall/roof/tree sits in front of the hit
// (a wall the occlusion system has already faded is see-through — tapping
// through it is fine, since the kid can see what they're tapping).
function tapBlockedByWall(hit) {
  raycaster.far = hit.distance - 0.05;
  const blockers = raycaster.intersectObjects(occludables, false);
  raycaster.far = Infinity;
  return blockers.some((b) => b.object.material.opacity >= 0.5);
}

// Show a pointer cursor when hovering a character or the puppy.
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return; // a hover cursor is meaningless on touch — skip the double raycast during camera drags
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hover = raycaster.intersectObjects(clickTargets(), false);
  renderer.domElement.style.cursor = hover.length && !tapBlockedByWall(hover[0]) ? 'pointer' : '';
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
function playerMaxHp() { return 30 + level * 6 + battlePower * 3 + (prizeHeart ? 20 : 0); } // Heart Charm: +20 health
// special-prize effects the player can buy with stars
let prizeSpeed = 1, prizeMagnet = false, prizeLucky = false, prizeLantern = false;
let prizeGreen = false, prizeRod = false, prizeHeart = false, prizeTrail = false;
function applyPrizeEffects() {
  prizeSpeed = prizes.speed ? 1.4 : 1;
  prizeMagnet = !!prizes.magnet; prizeLucky = !!prizes.lucky; prizeLantern = !!prizes.lantern;
  prizeGreen = !!prizes.green; prizeRod = !!prizes.rod; prizeHeart = !!prizes.heart; prizeTrail = !!prizes.trail;
  battlePower = battleWins + (prizes.power ? 6 : 0);
}
// ---- Rainbow Trail prize: little sparkles that follow the player ----
const TRAIL_COLORS = [0xff5a5a, 0xffa94d, 0xffe066, 0x74e08c, 0x57d7d7, 0x6aa6ff, 0xb18cff, 0xff7eb6];
const trailDotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(16, 16, 16, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const trailPool = [];
for (let i = 0; i < 16; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: trailDotTex, transparent: true, opacity: 0, depthWrite: false }));
  s.scale.setScalar(0.5); s.visible = false; s.userData.life = 0; scene.add(s); trailPool.push(s);
}
let trailIdx = 0, trailEmitAt = 0, trailColorI = 0;
function updateTrail(t, dt) {
  if (prizeTrail && player && player.userData.moving && t >= trailEmitAt) {
    trailEmitAt = t + 0.08;
    const s = trailPool[trailIdx]; trailIdx = (trailIdx + 1) % trailPool.length;
    s.position.set(player.position.x + (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.8, player.position.z + (Math.random() - 0.5) * 0.6);
    s.material.color.setHex(TRAIL_COLORS[trailColorI % TRAIL_COLORS.length]); trailColorI++;
    s.userData.life = 1; s.visible = true;
  }
  for (const s of trailPool) {
    if (s.userData.life <= 0) continue;
    s.userData.life -= dt * 1.5;
    if (s.userData.life <= 0) { s.visible = false; s.material.opacity = 0; continue; }
    s.material.opacity = s.userData.life * 0.9;
    s.scale.setScalar(0.3 + (1 - s.userData.life) * 0.5);
    s.position.y += dt * 0.4; // drift up gently
  }
}

let bagCount = 0, bagValue = 0; // crops & fish you've gathered, waiting to be sold at THE STORE
function addProduce(value) { bagCount += 1; bagValue += value; if (typeof refreshSell === 'function') refreshSell(); }
function sellProduce() {
  if (bagCount <= 0) return 0;
  const c = prizeLucky ? bagValue * 2 : bagValue, s = Math.max(1, Math.floor(bagCount / 2)); // coins + stars (helps you level up!)
  addCoins(c); addStars(s);
  if (typeof onSell === 'function') onSell();
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
  totalXP += n;     // and count toward your lifetime total, which unlocks new characters
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

// ---- Health + Hunger: a gentle Tamagotchi-style loop, never a survival nag ----
let health = 100, hunger = 100;
const healthFill = document.getElementById('healthFill');
const hungerFill = document.getElementById('hungerFill');
const statsEl = document.getElementById('stats');
function renderStats() {
  if (healthFill) { healthFill.style.width = Math.max(0, Math.min(100, health)) + '%'; healthFill.classList.toggle('low', health < 30); }
  if (hungerFill) { hungerFill.style.width = Math.max(0, Math.min(100, hunger)) + '%'; hungerFill.classList.toggle('low', hunger < 20); }
}
let statAccum = 0, faintCooldown = 0;
function statsPaused() {
  return (typeof uiModalOpen === 'function' && uiModalOpen())
      || (typeof miniGameActive === 'function' && miniGameActive())
      || (typeof battleActive !== 'undefined' && battleActive)
      || !player;
}
function updateStats(t, dt) {
  if (statsPaused()) return;
  statAccum += dt;
  if (statAccum < 1) return;            // tick ~once a second
  const secs = statAccum; statAccum = 0;
  hunger = Math.max(0, hunger - secs * (100 / 600));               // full → empty in ~10 min of active play
  if (hunger > 50) health = Math.min(100, health + secs * 2);       // well-fed → slowly heal
  else if (hunger <= 0) health = Math.max(0, health - secs * 1.5);  // starving → slowly weaken
  renderStats();
  if (health <= 0 && t > faintCooldown) faint(t);
}
function eatRestore(fill, heal) {
  hunger = Math.min(100, hunger + fill);
  health = Math.min(100, health + heal);
  renderStats();
  if (typeof saveGame === 'function') saveGame();
}
// move the player somewhere and carry the camera + orbit target by the same
// delta, so a teleport never strands the camera (matches how walking works).
function teleportPlayer(x, z) {
  if (!player) return;
  const ddx = x - player.position.x, ddz = z - player.position.z;
  player.position.set(x, houseFloorHeight(x, z), z);
  camera.position.x += ddx; camera.position.z += ddz;
  controls.target.x += ddx; controls.target.z += ddz;
  controls.update();
}
function faint(t) {
  faintCooldown = t + 5;
  keys.clear(); // drop held movement keys (like openBattle does)
  const mesh = player.userData.mesh || player.children.find((c) => c.isMesh && c.geometry?.type === 'PlaneGeometry');
  if (mesh) animate(mesh.rotation, { z: [-0.05, -1.4], duration: 500, ease: 'out(2)' }); // gentle tip-over
  setTimeout(() => {
    if (mesh) mesh.rotation.z = 0;
    if (typeof setHospitalFloor === 'function') setHospitalFloor(HOSP_CARE_FLOOR, true); // wake on the CARE floor so the beds + doctor are there
    teleportPlayer(HOSP_BED_POS.x + 2.5, HOSP_BED_POS.z);  // wake in the care room, by a bed
    health = 100; hunger = Math.max(hunger, 70);           // full health + topped-up hunger (no death loop)
    renderStats();
    if (typeof questToast === 'function') questToast('😴 You got sleepy — the nurse looked after you! 💗');
    if (typeof saveGame === 'function') saveGame();
  }, 650);
}

// ---- Eating: food values + a juicy chomp animation ----
// fill = hunger restored, heal = health restored. Cake > pizza > apple.
const FOOD_VALUES = {
  Apple: { emoji: '🍎', fill: 15, heal: 3 },
  Cake: { emoji: '🍰', fill: 35, heal: 12 },
  Pizza: { emoji: '🍕', fill: 30, heal: 9 },
  Marshmallow: { emoji: '🍡', fill: 18, heal: 4 },
  Crop: { emoji: '🥕', fill: 12, heal: 2 },
  Fish: { emoji: '🐟', fill: 20, heal: 6 },
  Sandwich: { emoji: '🥪', fill: 28, heal: 8 },
  IceCream: { emoji: '🍦', fill: 22, heal: 6 },
};
const isFood = (name) => !!FOOD_VALUES[name];
function playChomp() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    for (const start of [0, 0.16]) { // two little "nom" blips
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(300, now + start); o.frequency.exponentialRampToValueAtTime(150, now + start + 0.1);
      g.gain.setValueAtTime(0.0001, now + start); g.gain.exponentialRampToValueAtTime(0.14, now + start + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.13);
      o.connect(g).connect(audioCtx.destination); o.start(now + start); o.stop(now + start + 0.14);
    }
  } catch (e) { /* no audio — fine */ }
}
// show a character eating: a food emoji pops at the mouth with bites + crumbs,
// then vanishes. One anime.js timeline per event, so it can't stack or drift.
function playEat(holder, emoji) {
  if (!holder) return;
  const s = makeEmojiSprite(emoji); s.visible = true;
  s.position.set(0.15, CHAR_HEIGHT * 0.5, 0.2); s.scale.set(0.9, 0.9, 1); holder.add(s);
  animate(s.scale, { x: [0.9, 1.35, 0.85, 1.35, 0.85, 0.15], y: [0.9, 1.35, 0.85, 1.35, 0.85, 0.15], duration: 950, ease: 'inOut(2)', onComplete: () => holder.remove(s) });
  for (let i = 0; i < 5; i++) { // crumb sparkles fall away
    const c = makeEmojiSprite('✨'); c.visible = true; c.scale.set(0.28, 0.28, 1);
    c.position.set((Math.random() - 0.5) * 0.8, CHAR_HEIGHT * 0.45, 0.3); holder.add(c);
    animate(c.position, { y: c.position.y - 1.1, duration: 650, delay: 200 + i * 40, ease: 'in(2)', onComplete: () => holder.remove(c) });
    animate(c.material, { opacity: [1, 0], duration: 650, delay: 200 + i * 40 });
  }
  playChomp();
}
// the PLAYER eats a food item: animation + restore hunger/health + a Yum bubble.
function eatFood(name) {
  const f = FOOD_VALUES[name]; if (!f || !player) return false;
  playEat(player, f.emoji);
  eatRestore(f.fill, f.heal);
  const mesh = player.userData.mesh || player.children.find((c) => c.isMesh && c.geometry?.type === 'PlaneGeometry');
  if (mesh && typeof showBubble === 'function') showBubble(mesh, player.userData.char?.name || 'Yum', 'Yum! 😋', CHAR_HEIGHT * 0.55);
  return true;
}
// share a snack with a roaming friend you walk up to: they eat, say thanks, and
// sometimes hand you a thank-you coin. Counts toward the "Feed friends" quest.
const fedFriends = new Set();
const SHARE_FOODS = ['🍎', '🍰', '🍕', '🍪', '🍇', '🥪', '🍦'];
function shareFoodWith(holder, mesh, char) {
  playEat(holder, SHARE_FOODS[Math.floor(Math.random() * SHARE_FOODS.length)]);
  if (typeof showBubble === 'function') showBubble(mesh, char.name, 'Yum, thanks! 😋', CHAR_HEIGHT * 0.55);
  const id = char.id;
  if (!fedFriends.has(id)) {
    fedFriends.add(id);
    if (typeof questBump === 'function') questBump('feed');
    if (Math.random() < 0.4 && typeof addCoins === 'function') { addCoins(1); if (typeof onCoinCollected === 'function') onCoinCollected(); } // a thank-you coin
  }
}
// ambient life: every couple of seconds, a character hanging out at the cafe
// takes a bite (so the cafe always looks lively and social)
let cafeEatAt = 0;
function updateCafeLife(t) {
  if (t < cafeEatAt) return;
  cafeEatAt = t + 2.2;
  const here = billboards.filter((b) => { const h = b.parent; return h && !h.userData.isPlayer && Math.hypot(h.position.x - CAFE.x, h.position.z - CAFE.z) < 7; });
  if (here.length) playEat(here[Math.floor(Math.random() * here.length)].parent, SHARE_FOODS[Math.floor(Math.random() * SHARE_FOODS.length)]);
}
// Floor 3 care beds → the doctor tops you up to full health
function careHeal() {
  if (health >= 100 && hunger >= 100) { if (typeof questToast === 'function') questToast('You feel great already! 💪'); return; }
  health = 100; hunger = Math.min(100, hunger + 10); renderStats();
  if (typeof questToast === 'function') questToast('🩺 The doctor checked you up — full health! ❤️');
  if (typeof playDing === 'function') playDing();
  if (typeof saveGame === 'function') saveGame();
}
// Floor 4 nursery → rock a baby to sleep for a star (gentle cooldown so it's not farmable)
let rockBabyAt = 0;
function rockBaby() {
  const t = timer.getElapsed();
  if (t < rockBabyAt) { if (typeof questToast === 'function') questToast('Shhh… the baby is sleeping 😴'); return; }
  rockBabyAt = t + 12;
  if (typeof questToast === 'function') questToast('👶 You rocked the baby to sleep! 😴✨');
  if (typeof addStars === 'function') addStars(1);
  if (typeof playDing === 'function') playDing();
}
// tap the cafe counter → a free snack the player eats on the spot
function getCafeFood() {
  const menu = ['Cake', 'Pizza', 'Sandwich', 'IceCream', 'Apple'];
  const name = menu[Math.floor(Math.random() * menu.length)];
  if (eatFood(name)) {
    if (typeof questToast === 'function') questToast(`Free ${FOOD_VALUES[name].emoji} at the cafe — yum!`);
    if (typeof questBump === 'function') questBump('cafe');
  }
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
  { name: 'Sunbeam', bpm: 116, lead: 'triangle',
    melody: [0, 2, 4, 5, 7, 9, 7, 5, 4, 2, 0, 4, 7, 9, 11, 12],
    bass:   [0, 0, 5, 5, 7, 7, 4, 4] },
  { name: 'Parade', bpm: 130, lead: 'sawtooth',
    melody: [0, 0, 7, 0, 5, 0, 7, 0, 4, 4, 9, 4, 7, 4, 9, 4],
    bass:   [0, 7, 0, 7, 5, 9, 0, 7] },
  { name: 'Twinkle', bpm: 156, lead: 'triangle',
    melody: [12, 16, 19, 16, 14, 12, 11, 9, 7, 9, 11, 12, 14, 16, 19, 24],
    bass:   [0, 5, 7, 9, 0, 5, 7, 12] },
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
  // index by each track's own array length (not a hardcoded 16/8) so a
  // mismatched track array fails safe instead of reading undefined -> NaN
  while (nextNoteTime < audioCtx.currentTime + 0.25) {
    const i = musicStep % tr.melody.length;
    musTone(musFreq(tr.melody[i], 523.25), nextNoteTime, eighth * 0.9, tr.lead, 0.12); // lead
    if (i % 2 === 0) musTone(musFreq(tr.bass[(i / 2) % tr.bass.length], 130.81), nextNoteTime, eighth * 1.7, 'sine', 0.16); // bass
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

// Town building positions — spaced out so there's room to walk between them.
// Everything about each building (its mesh, wall colliders, standee, sign, sign,
// paths, no-tree zone) is driven off these so nothing ever drifts apart.
const STORE_POS = { x: 0, z: -17 };
const HOSP_POS = { x: 26, z: -19 };  // big hospital, off to the east with elbow room
const HOSP_W = 20, HOSP_D = 14, HOSP_DOOR = 5; // large multi-room footprint
const HOSP_BED_POS = { x: 26 - 5, z: -19 - 3.5 }; // a care-room bed = where you wake up after fainting
// A tall multi-story hospital done with an ELEVATOR that swaps the interior per
// floor (real stacked floors are impossible with single-valued floor height +
// height-less 2D wall colliders + an overhead camera — confirmed by review).
const HOSP_FLOORS = [
  { name: 'RECEPTION', emoji: '🛎️' },
  { name: 'PHARMACY', emoji: '💊' },
  { name: 'CARE BEDS', emoji: '🩹' },
  { name: 'NURSERY & CAFE', emoji: '🍼' },
];
const HOSP_CARE_FLOOR = 2;       // 0-indexed floor with the care beds (faint wake)
let hospFloorGroups = [];         // one THREE.Group of props per floor; only the current one is visible
let hospCurrentFloor = 0;
let hospDoctor = null;            // doctor standee — visible only on the care floor
let hospFloorNumSprite = null;    // the lit floor number over the front door
let hospElevatorPos = null;       // world pos of the elevator pad (proximity opens the picker)
let hospCareTrigger = null, hospNurseryTrigger = null; // tap the beds to heal / rock a baby (per-floor)
function buildStore() {
  const store = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xead9b0, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc0563f, roughness: 0.8 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xd8c59a, roughness: 1 });

  const W = 9, D = 6, H = 4.8, T = 0.4, DOOR = 4; // tall enough that a 3.4-unit character clears the door lintel
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
  parts.forEach((m) => { if (m.position.y > 0.2) registerOccluder(m); }); // walls/roof fade when they hide you

  const sign = makeSign('THE STORE');
  sign.position.set(0, H + 1.3, D / 2 - 0.05);                  // on top, facing the courtyard
  store.add(sign);

  store.position.set(STORE_POS.x, 0, STORE_POS.z);
  scene.add(store);
  noTreeZones.push({ x: STORE_POS.x, z: STORE_POS.z, r: 9 });
}
buildStore();

// The HOSPITAL — on the other (east) side of THE STORE.
// A big open-plan hospital: six labelled areas down two sides of a central
// aisle (waiting room, pharmacy, care beds on the left; cafeteria, restrooms,
// nursery on the right). Only the outer walls get collision (registered
// separately) — the interior is prop-only + low dividers, so a kid can walk
// everywhere and never get trapped in a tiny room.
function buildHospital() {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.9 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xcdd6dc, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd2d8de, roughness: 0.8 });
  const winMat = new THREE.MeshStandardMaterial({ color: 0x8fc4e8, roughness: 0.3, metalness: 0.1, emissive: 0x1a3a4a, emissiveIntensity: 0.25 });
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xe23b3b, roughness: 0.5, emissive: 0x4a0000, emissiveIntensity: 0.2 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xeef3f6, roughness: 1 });
  const bedW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const bedFrame = new THREE.MeshStandardMaterial({ color: 0xb9c0c7, roughness: 0.6 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.9 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x6fc3c9, roughness: 0.7 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xffb0d0, roughness: 0.8 });
  const blue = new THREE.MeshStandardMaterial({ color: 0xa9c6ff, roughness: 0.8 });
  const divMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xaab4bd, roughness: 0.4, metalness: 0.5 });

  const W = HOSP_W, D = HOSP_D, GH = 4.8, T = 0.4, DOOR = HOSP_DOOR;
  const NFLOORS = HOSP_FLOORS.length, BANDH = 3.0, EXT_H = NFLOORS * BANDH; // tall multi-story facade
  const shell = [];
  const sink = (arr, m) => { if (Array.isArray(arr)) arr.push(m); else if (arr && arr.add) arr.add(m); }; // array → collect; group → add
  const box = (arr, w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); sink(arr, m); return m; };
  const cyl = (arr, r1, r2, h, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 12), mat); m.position.set(x, y, z); sink(arr, m); return m; };

  // ---- TALL SHELL: outer walls up the full height, a ground doorway, roof, floor ----
  box(shell, W, EXT_H, T, wallMat, 0, EXT_H / 2, -D / 2);   // back
  box(shell, T, EXT_H, D, wallMat, -W / 2, EXT_H / 2, 0);   // left
  box(shell, T, EXT_H, D, wallMat, W / 2, EXT_H / 2, 0);    // right
  const fw = (W - DOOR) / 2;
  box(shell, fw, EXT_H, T, wallMat, -(W / 2 - fw / 2), EXT_H / 2, D / 2);
  box(shell, fw, EXT_H, T, wallMat, (W / 2 - fw / 2), EXT_H / 2, D / 2);
  box(shell, DOOR, EXT_H - GH, T, wallMat, 0, GH + (EXT_H - GH) / 2, D / 2); // facade above the ground door
  box(shell, W + 0.9, 0.5, D + 0.9, roofMat, 0, EXT_H + 0.25, 0);           // roof
  box(shell, W, 0.1, D, floorMat, 0, 0.05, 0);                              // floor (flat, y≈0)
  // floor bands wrapping the building (reads as separate storeys)
  for (let f = 1; f < NFLOORS; f++) box(shell, W + 0.35, 0.3, D + 0.35, bandMat, 0, f * BANDH, 0);
  // rows of windows on the front + sides, one row per storey
  for (let f = 0; f < NFLOORS; f++) {
    const wy = f * BANDH + BANDH * 0.55;
    for (const wx of [-6.5, -2.2, 2.2, 6.5]) if (f > 0 || Math.abs(wx) > DOOR / 2 + 1) box(shell, 1.5, 1.3, 0.12, winMat, wx, wy, D / 2 + 0.06);
    for (const wz of [-4, 0, 4]) { box(shell, 0.12, 1.3, 1.5, winMat, -W / 2 - 0.06, wy, wz); box(shell, 0.12, 1.3, 1.5, winMat, W / 2 + 0.06, wy, wz); }
  }
  for (const cx of [-(W / 2 - fw / 2), (W / 2 - fw / 2)]) { box(shell, 0.5, 1.8, 0.1, crossMat, cx, EXT_H - 2, D / 2 + 0.06); box(shell, 1.4, 0.55, 0.1, crossMat, cx, EXT_H - 2, D / 2 + 0.06); } // red crosses up high
  shell.forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
  shell.forEach((m) => { if (m.position.y > 0.2 && m.material !== winMat) registerOccluder(m); }); // walls fade when they hide you

  // ---- ELEVATOR (fixed front-left corner, same on every floor) ----
  const EX = -W / 2 + 2.4, EZ = D / 2 - 2.4;
  box(g, 2.6, GH, 0.3, metal, EX, GH / 2, EZ - 1.3);            // shaft back
  box(g, 0.3, GH, 2.6, metal, EX - 1.3, GH / 2, EZ);           // shaft left
  box(g, 1.1, GH - 0.4, 0.2, new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.4, metalness: 0.6 }), EX, (GH - 0.4) / 2, EZ - 1.15); // sliding doors panel
  cyl(g, 1.4, 1.4, 0.06, new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.6, emissive: 0x3a2e00, emissiveIntensity: 0.3 }), EX, 0.08, EZ); // glowing floor pad
  const padSign = makeEmojiSprite('🛗'); padSign.visible = true; padSign.scale.set(1.2, 1.2, 1); padSign.position.set(EX, 2.4, EZ); g.add(padSign);
  hospElevatorPos = { x: HOSP_POS.x + EX, z: HOSP_POS.z + EZ };

  // ---- helpers for per-floor content ----
  const label = (fg, text, emoji) => {
    const s = makeSign(text); s.scale.setScalar(0.5); s.position.set(0, 4.0, D / 2 - 2.5); fg.add(s);
    const e = makeEmojiSprite(emoji); e.visible = true; e.scale.set(1.3, 1.3, 1); e.position.set(0, 3.1, D / 2 - 2.5); fg.add(e);
  };
  const RRX = W / 2 - 2.2, RRZ = -D / 2 + 2.2; // a restroom in the same back-right corner on EVERY floor
  const restroom = (fg) => {
    for (const [sx, se] of [[RRX - 1.0, '🚹'], [RRX + 1.0, '🚺']]) {
      box(fg, 1.6, 2.4, 0.15, divMat, sx, 1.2, RRZ - 1.0);
      box(fg, 0.15, 2.4, 1.6, divMat, sx - 0.75, 1.2, RRZ - 0.2);
      box(fg, 0.15, 2.4, 1.6, divMat, sx + 0.75, 1.2, RRZ - 0.2);
      const e = makeEmojiSprite(se); e.visible = true; e.scale.set(0.8, 0.8, 1); e.position.set(sx, 2.6, RRZ); fg.add(e);
    }
    const rs = makeEmojiSprite('🚻'); rs.visible = true; rs.scale.set(1.0, 1.0, 1); rs.position.set(RRX, 3.2, RRZ); fg.add(rs);
  };

  hospFloorGroups = [];
  for (let f = 0; f < NFLOORS; f++) {
    const fg = new THREE.Group();
    label(fg, HOSP_FLOORS[f].name, HOSP_FLOORS[f].emoji);
    restroom(fg); // every floor has a restroom (a cute running gag)
    if (f === 0) { // RECEPTION / WAITING
      box(fg, 4.5, 1.1, 1.2, wood, 0, 0.55, -2.5);               // reception desk
      box(fg, 0.4, 1.4, 0.3, teal, -1.8, 0.7, -2.5); box(fg, 0.4, 1.4, 0.3, teal, 1.8, 0.7, -2.5);
      const bell = makeEmojiSprite('🛎️'); bell.visible = true; bell.scale.set(0.6, 0.6, 1); bell.position.set(0, 1.4, -2.5); fg.add(bell);
      for (const bx of [-4, 4]) { box(fg, 2.6, 0.35, 0.7, wood, bx, 0.45, 3); box(fg, 2.6, 0.7, 0.15, wood, bx, 0.85, 2.65); } // waiting benches
    } else if (f === 1) { // PHARMACY
      box(fg, 3.6, 1.0, 0.9, teal, -2, 0.5, -1);                 // counter
      box(fg, 3.6, 2.0, 0.35, wallMat, -2, 1.6, -2.2);           // shelf
      const pillCols = [0xff6b6b, 0x6bd0ff, 0xffe06b, 0x9d7bff, 0x74e08c, 0xff9ec7];
      for (let i = 0; i < 6; i++) cyl(fg, 0.15, 0.15, 0.55, new THREE.MeshStandardMaterial({ color: pillCols[i], roughness: 0.5 }), -3.5 + i * 0.6, 1.75, -2.15);
      box(fg, 0.35, 1.0, 0.08, crossMat, -2, 3.0, -2.35); box(fg, 0.95, 0.35, 0.08, crossMat, -2, 3.0, -2.35); // Rx
    } else if (f === 2) { // CARE BEDS (faint wake floor)
      for (let i = 0; i < 3; i++) { const bx = -5 + i * 3.4; box(fg, 2.2, 0.5, 1.1, bedFrame, bx, 0.3, -3.2); box(fg, 2.1, 0.22, 1.0, bedW, bx, 0.6, -3.2); box(fg, 0.6, 0.22, 0.9, bedW, bx - 0.75, 0.78, -3.2); }
      const heart = makeEmojiSprite('❤️'); heart.visible = true; heart.scale.set(1.0, 1.0, 1); heart.position.set(0, 2.4, -3.2); fg.add(heart);
      hospCareTrigger = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hospCareTrigger.rotation.x = -Math.PI / 2; hospCareTrigger.position.set(-1.5, 0.7, -3.2); hospCareTrigger.userData.isCareBed = true; fg.add(hospCareTrigger);
    } else { // NURSERY + CAFE
      for (let i = 0; i < 3; i++) { const cx = -6 + i * 2.0; const cm = i === 1 ? blue : pink; box(fg, 1.4, 0.7, 1.0, cm, cx, 0.5, -3.4); box(fg, 1.5, 0.14, 1.1, bedW, cx, 0.9, -3.4); const baby = makeEmojiSprite(['👶','🍼','🧸'][i]); baby.visible = true; baby.scale.set(0.55,0.55,1); baby.position.set(cx, 1.15, -3.4); fg.add(baby); }
      for (const tx of [2, 5]) { box(fg, 1.6, 0.12, 1.6, wood, tx, 0.75, 2.5); cyl(fg, 0.12, 0.12, 0.7, wood, tx, 0.38, 2.5); const food = makeEmojiSprite(tx === 2 ? '🍰' : '🍎'); food.visible = true; food.scale.set(0.7,0.7,1); food.position.set(tx, 1.2, 2.5); fg.add(food); }
      hospNurseryTrigger = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 2.6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hospNurseryTrigger.rotation.x = -Math.PI / 2; hospNurseryTrigger.position.set(-4, 0.7, -3.4); hospNurseryTrigger.userData.isNursery = true; fg.add(hospNurseryTrigger);
    }
    fg.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    fg.visible = false;
    g.add(fg); hospFloorGroups.push(fg);
  }

  const sign = makeSign('HOSPITAL'); sign.position.set(0, EXT_H + 1.2, D / 2 - 0.05); g.add(sign);
  // the current floor number, lit over the door
  hospFloorNumSprite = makeEmojiSprite('1'); hospFloorNumSprite.visible = true; hospFloorNumSprite.scale.set(1.4, 1.4, 1); hospFloorNumSprite.position.set(0, GH + 1.0, D / 2 + 0.4); g.add(hospFloorNumSprite);

  g.position.set(HOSP_POS.x, 0, HOSP_POS.z);
  scene.add(g);
  noTreeZones.push({ x: HOSP_POS.x, z: HOSP_POS.z, r: Math.max(W, D) / 2 + 3 });
}
buildHospital();
// swap the hospital interior to a floor (only that floor's props are visible)
const hospFloorsVisited = new Set();
function setHospitalFloor(n, silent) {
  n = Math.max(0, Math.min(HOSP_FLOORS.length - 1, n));
  hospCurrentFloor = n;
  hospFloorGroups.forEach((fg, i) => { if (fg) fg.visible = (i === n); });
  if (hospDoctor) hospDoctor.visible = (n === HOSP_CARE_FLOOR);
  if (hospFloorNumSprite && typeof setEmoji === 'function') setEmoji(hospFloorNumSprite, String(n + 1));
  if (typeof refreshElevatorButtons === 'function') refreshElevatorButtons(); // keep the panel's highlight in sync
  if (!silent) {
    if (typeof playDing === 'function') playDing();
    if (typeof showFloorBanner === 'function') showFloorBanner(n);
    markFloorVisited(n);
  }
}
function markFloorVisited(n) { // "Hospital Tour" quest — one bump per NEW floor
  if (hospFloorsVisited.has(n)) return;
  hospFloorsVisited.add(n);
  if (typeof questBump === 'function') questBump('hosptour');
}
// ---- Elevator floor-picker: opens while you stand on the pad ----
let elevatorEl = null, elevatorOpen = false, floorBannerEl = null;
function buildElevatorPanel() {
  elevatorEl = document.createElement('div'); elevatorEl.id = 'elevator';
  const title = document.createElement('div'); title.className = 'elev-title'; title.textContent = '🛗 Pick a floor'; elevatorEl.appendChild(title);
  HOSP_FLOORS.forEach((f, i) => {
    const b = document.createElement('div'); b.className = 'elev-btn';
    const num = document.createElement('span'); num.className = 'elev-num'; num.textContent = i + 1;
    const name = document.createElement('span'); name.textContent = f.name;
    const em = document.createElement('span'); em.className = 'elev-emoji'; em.textContent = f.emoji + '🚻';
    b.append(num, name, em);
    b.addEventListener('click', () => { if (i !== hospCurrentFloor) setHospitalFloor(i); refreshElevatorButtons(); });
    elevatorEl.appendChild(b);
  });
  document.body.appendChild(elevatorEl);
}
function refreshElevatorButtons() {
  if (!elevatorEl) return;
  [...elevatorEl.querySelectorAll('.elev-btn')].forEach((b, i) => b.classList.toggle('here', i === hospCurrentFloor));
}
function openElevator() { if (!elevatorEl) buildElevatorPanel(); elevatorOpen = true; markFloorVisited(hospCurrentFloor); refreshElevatorButtons(); elevatorEl.style.display = 'flex'; animate(elevatorEl, { opacity: [0, 1], duration: 200 }); }
function closeElevator() { if (!elevatorEl) return; elevatorOpen = false; elevatorEl.style.display = 'none'; }
function updateElevator() {
  if (!player || !hospElevatorPos) return;
  const dBldg = Math.hypot(player.position.x - HOSP_POS.x, player.position.z - HOSP_POS.z);
  if (dBldg > 14 && hospCurrentFloor !== 0) setHospitalFloor(0, true); // walked out → reset to Floor 1
  const near = Math.hypot(player.position.x - hospElevatorPos.x, player.position.z - hospElevatorPos.z) < 3.2;
  const blocked = (typeof miniGameActive === 'function' && miniGameActive()) || (typeof battleActive !== 'undefined' && battleActive) || (typeof uiModalOpen === 'function' && uiModalOpen());
  if (near && !elevatorOpen && !blocked) openElevator();
  else if ((!near || blocked) && elevatorOpen) closeElevator();
}
function showFloorBanner(n) {
  if (!floorBannerEl) { floorBannerEl = document.createElement('div'); floorBannerEl.id = 'floorbanner'; document.body.appendChild(floorBannerEl); }
  floorBannerEl.textContent = `FLOOR ${n + 1} · ${HOSP_FLOORS[n].name} ${HOSP_FLOORS[n].emoji}`;
  floorBannerEl.style.display = 'block';
  animate(floorBannerEl, { opacity: [0, 1], scale: [0.8, 1], duration: 260, ease: 'out(3)' });
  clearTimeout(floorBannerEl._t); floorBannerEl._t = setTimeout(() => animate(floorBannerEl, { opacity: 0, duration: 400, onComplete: () => { floorBannerEl.style.display = 'none'; } }), 1600);
}

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
  return holder;
}
const SHOPKEEPER_POS = new THREE.Vector3(STORE_POS.x, 0, STORE_POS.z - 1.6);
addStandee('shopkeeper.png', 'Shopkeeper', SHOPKEEPER_POS);
// the Doctor stands by the care beds; only shown on the care floor
hospDoctor = addStandee('doctor.png', 'Doctor', new THREE.Vector3(HOSP_POS.x - 4.5, 0, HOSP_POS.z - 3.5));
if (typeof setHospitalFloor === 'function') setHospitalFloor(0, true); // start on Floor 1, silently (also hides the doctor)

// ---------------------------------------------------------------------------
// Campfire in the middle of town — stones, logs, flickering flames + warm light.
// ---------------------------------------------------------------------------
const campfire = { flames: [], light: null };
let campfireTrigger = null; // invisible tap-target over the campfire (toast a marshmallow)
function toastMarshmallow() {
  if (typeof questToast === 'function') questToast('Toasty marshmallow! 🔥😋');
  if (typeof playDing === 'function') playDing();
  if (typeof onToastMarshmallow === 'function') onToastMarshmallow();
}
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
      new THREE.ConeGeometry(0.34 - i * 0.07, 1.25 - i * 0.24, 8), // a bit taller/bigger flames
      new THREE.MeshBasicMaterial({ color: flameColors[i] })
    );
    f.position.set((i - 1) * 0.08, 0.65 - i * 0.08, 0);
    f.userData.phase = Math.random() * Math.PI * 2;
    g.add(f); campfire.flames.push(f);
  }
  campfire.light = new THREE.PointLight(0xff8a30, 2.2, 17, 2); // brighter + reaches a bit further (still warm, decay 2)
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

  // invisible tap-target so tapping the campfire toasts a marshmallow (transparent,
  // not visible:false — a visible:false mesh can't be raycast/tapped)
  const trigger = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  trigger.rotation.x = -Math.PI / 2; trigger.position.y = 0.6; trigger.userData.isCampfire = true;
  g.add(trigger); campfireTrigger = trigger;

  g.position.set(x, 0, z); scene.add(g);
}

// Campsite behind THE STORE & the hospital: the campfire, log seats, and a
// teepee tent for each of the six characters.
const CAMP = { x: 6, z: -40 }; // pushed south so there's open ground between town & camp
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
// The tents sit in a HORSESHOE, not a full ring — leaving a wide opening on the
// town-facing (+z) side so players can walk straight in without bumping a tent.
// One shared layout drives both the visible tents and their colliders, so the
// two can never drift out of sync.
const CAMP_ENTRANCE_A = Math.PI / 2;         // opening faces +z, toward town
const CAMP_OPEN_HALF = 0.52;                 // half-width of the opening (~30°)
const CAMP_TENT_R = 10, CAMP_TENT_COLL = 1.0, CAMP_KIDTENT_COLL = 0.55;
function campTentLayout() {
  const start = CAMP_ENTRANCE_A + CAMP_OPEN_HALF;              // first tent just past the opening
  const span = Math.PI * 2 - CAMP_OPEN_HALF * 2;              // arc the tents occupy
  return CAMP_TENTS.map((c, i) => {
    const a = start + (i + 0.5) * (span / CAMP_TENTS.length);
    const tx = CAMP.x + Math.cos(a) * CAMP_TENT_R, tz = CAMP.z + Math.sin(a) * CAMP_TENT_R;
    const kid = c.kid ? { x: tx - Math.sin(a) * 2.1, z: tz + Math.cos(a) * 2.1 } : null;
    return { a, tx, tz, color: c.color, kid };
  });
}
function buildCampsite() {
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(13, 48), new THREE.MeshStandardMaterial({ color: 0x6e5a3e, roughness: 1 }));
  dirt.rotation.x = -Math.PI / 2; dirt.position.set(CAMP.x, 0.05, CAMP.z); dirt.receiveShadow = true; scene.add(dirt);
  noTreeZones.push({ x: CAMP.x, z: CAMP.z, r: 14 });
  // a welcoming dirt walkway from the town side, through the tent opening, up to
  // the campfire — a flat ground decal (no collision), so kids walk right in
  const ex = CAMP.x + Math.cos(CAMP_ENTRANCE_A) * 15, ez = CAMP.z + Math.sin(CAMP_ENTRANCE_A) * 15;
  const ix = CAMP.x + Math.cos(CAMP_ENTRANCE_A) * 4, iz = CAMP.z + Math.sin(CAMP_ENTRANCE_A) * 4;
  buildPath(ex, ez, ix, iz, 2.6);
  buildCampfire(CAMP.x, CAMP.z); // the campfire + marshmallows live at the campsite now
  const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 8), logMat); log.rotation.z = Math.PI / 2; log.rotation.y = a; log.position.set(CAMP.x + Math.cos(a) * 3.2, 0.22, CAMP.z + Math.sin(a) * 3.2); scene.add(log); }
  campTentLayout().forEach((t) => {
    buildTent(t.tx, t.tz, t.color, 1);
    if (t.kid) buildTent(t.kid.x, t.kid.z, t.color, 0.55); // small kid tent beside the parent's
  });
  const sign = makeSign('CAMP'); sign.scale.setScalar(0.55); sign.position.set(CAMP.x, 2.8, CAMP.z - 13); scene.add(sign);
  // a few lamp posts around the campsite so it glows at night
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.78; makeLampPost(CAMP.x + Math.cos(a) * 12.5, CAMP.z + Math.sin(a) * 12.5); }
}
buildCampsite();
function updateCampfire(t) {
  const flick = 0.82 + Math.sin(t * 12) * 0.1 + Math.sin(t * 23.3) * 0.08;
  for (const f of campfire.flames) {
    f.scale.y = 0.85 + Math.sin(t * 10 + f.userData.phase) * 0.22;
    f.rotation.y = t * 2 + f.userData.phase;
  }
  if (campfire.light) campfire.light.intensity = (isNight ? 4.6 : 2.6) * flick; // brighter, warm glow
}

// ---------------------------------------------------------------------------
// Ambulance parked by the hospital, with a blinking red/blue light bar.
// ---------------------------------------------------------------------------
const ambulanceLights = [];
let ambulance = null;
const AMB_R = 11, AMB_SPEED = 0.16; // radius of its road loop — small enough that the body clears every building (house fronts ~13.75, store front 13)
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
  ambulanceLights.push(rl.material, bl.material); ambulance = g;
}
buildAmbulance(AMB_R, -0, 0);
// keep the ambulance's driving lane clear of scattered trees (trees have no
// collision, so steering alone can't avoid them) — must be pushed before
// scatterTrees() runs in the roster-fetch callback
for (let i = 0; i < 20; i++) {
  const a = (i / 20) * Math.PI * 2;
  noTreeZones.push({ x: Math.cos(a) * AMB_R, z: Math.sin(a) * AMB_R, r: 2.5 });
}
// A visible ring ROAD the ambulance drives on: a flat dark asphalt annulus at
// y=0.03 (below the wheels, no collision so kids can cross it) with a dashed
// yellow centerline. The van follows this exact circle, which is small enough
// to clear every building — so it never drives through a house wall again.
function buildAmbulanceRoad() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(AMB_R - 1.0, AMB_R + 1.0, 64),
    new THREE.MeshStandardMaterial({ color: 0x3c3f47, roughness: 1 })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.receiveShadow = true; scene.add(ring);
  // dashed yellow centerline
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.16), dashMat);
    dash.rotation.x = -Math.PI / 2; dash.rotation.z = -a;
    dash.position.set(Math.cos(a) * AMB_R, 0.05, Math.sin(a) * AMB_R);
    scene.add(dash);
  }
}
buildAmbulanceRoad();
function updateAmbulance(t, dt) {
  if (ambulanceLights.length < 2) return;
  const on = Math.sin(t * 6) > 0;
  ambulanceLights[0].emissiveIntensity = on ? 1.5 : 0.2; // red
  ambulanceLights[1].emissiveIntensity = on ? 0.2 : 1.5; // blue (alternates)
  if (ambulance && dt) {
    const prevX = ambulance.position.x, prevZ = ambulance.position.z;
    // aim one step further along the circle from where it ACTUALLY is, so any
    // wall pushback makes it slide along the wall instead of tunneling through
    const a = Math.atan2(prevZ, prevX) + AMB_SPEED * dt;
    let nx = Math.cos(a) * AMB_R, nz = Math.sin(a) * AMB_R;
    const stepX = nx - prevX, stepZ = nz - prevZ;
    const stepLen = Math.hypot(stepX, stepZ);
    const maxStep = AMB_R * AMB_SPEED * dt + 0.08;
    if (stepLen > maxStep) { nx = prevX + (stepX / stepLen) * maxStep; nz = prevZ + (stepZ / stepLen) * maxStep; }
    [nx, nz] = resolveWalls(nx, nz, prevX, prevZ, 0.45); // safety net — the road already clears everything
    // the van politely WAITS instead of driving through anyone crossing the road
    if (player && Math.hypot(nx - player.position.x, nz - player.position.z) < 2.4) return;
    const petH = (typeof petDog !== 'undefined' && petDog && petDog.holder) || (typeof petCat !== 'undefined' && petCat && petCat.holder);
    if (petH && Math.hypot(nx - petH.position.x, nz - petH.position.z) < 2.0) return;
    const mx = nx - prevX, mz = nz - prevZ;
    ambulance.position.set(nx, 0, nz);
    if (Math.hypot(mx, mz) > 1e-3) ambulance.rotation.y = Math.atan2(-mz, mx); // face travel direction
  }
}

// ---------------------------------------------------------------------------
// A pet dog that trots after the player (and climbs stairs with them).
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Your own pet — chosen after picking a character: a dog, a cat, or none.
// ---------------------------------------------------------------------------
let petDog = null, petCat = null;
const DOG_NAME = 'Daisy', CAT_NAME = 'Whiskers';
let petKind = 'none'; // 'dog' | 'cat' | 'none' — the CURRENT character's pet choice
function currentPlayerPet() { return petDog || petCat || null; }
function spawnPlayerDog(name) {
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
  const px = player ? player.position.x + 1.5 : 4, pz = player ? player.position.z + 1.5 : 7;
  holder.position.set(px, 0, pz);
  holder.add(mesh);
  const petName = (name || DOG_NAME).trim().slice(0, 12) || DOG_NAME;
  const label = makeNameLabel(petName);
  label.position.set(0, size + 0.35, 0);
  label.scale.set(2.0, 0.5, 1);
  holder.add(label);
  scene.add(holder);
  petDog = { holder, mesh, baseY: size / 2, playUntil: 0, station: null, name: petName };
  spawnDoghouse(petName);
}
function spawnPlayerCat(name) {
  const tex = textureLoader.load('./assets/characters/cat.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const size = 1.4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
  );
  mesh.position.y = size / 2;
  const holder = new THREE.Group();
  const px = player ? player.position.x + 1.5 : 4, pz = player ? player.position.z + 1.5 : 7;
  holder.position.set(px, 0, pz);
  holder.add(mesh);
  const petName = (name || CAT_NAME).trim().slice(0, 12) || CAT_NAME;
  const label = makeNameLabel(petName);
  label.position.set(0, size + 0.35, 0);
  label.scale.set(2.0, 0.5, 1);
  holder.add(label);
  scene.add(holder);
  petCat = { holder, mesh, baseY: size / 2, playUntil: 0, station: null, name: petName };
}
function removePlayerPet() {
  if (petDog) { scene.remove(petDog.holder); petDog = null; }
  if (petCat) { scene.remove(petCat.holder); petCat = null; }
  if (doghouse) { scene.remove(doghouse); doghouse = null; }
  ballState = 'idle'; if (typeof ball !== 'undefined') ball.visible = false;
}
function applyPetChoice(kind, name) {
  removePlayerPet();
  petKind = kind === 'dog' || kind === 'cat' ? kind : 'none';
  if (petKind === 'dog') spawnPlayerDog(name);
  else if (petKind === 'cat') spawnPlayerCat(name);
  if (typeof updateThrowBtnVisibility === 'function') updateThrowBtnVisibility();
  if (typeof saveGame === 'function') saveGame();
}
// send the current pet off to play at the pet park (tap/click the pet park to trigger)
const PET_PLAY_DURATION = 9;
function startPetPark() {
  const pet = currentPlayerPet();
  if (!pet) { if (typeof questToast === 'function') questToast("You don't have a pet right now! 🐾"); return; }
  if (!PET_STATIONS.length) return;
  pet.playUntil = timer.getElapsed() + PET_PLAY_DURATION;
  pet.station = PET_STATIONS[Math.floor(Math.random() * PET_STATIONS.length)];
  if (typeof questToast === 'function') questToast(`${pet.name} is off to play! 🐾`);
  if (typeof onPetParkPlay === 'function') onPetParkPlay(); // quest: send your pet to play
}
// while the pet is off playing, aim it at its chosen pet-park station instead of the player
function petPlayTargetOrNull(pet, t) {
  if (!pet.playUntil || t >= pet.playUntil) { pet.playUntil = 0; pet.station = null; return null; }
  if (!pet.station) pet.station = PET_STATIONS[Math.floor(Math.random() * PET_STATIONS.length)];
  return pet.station;
}
// offsets a follow point to the LEFT/RIGHT of the camera's view (not fore/aft of
// the player), so a pet/child never lines up directly behind — and gets hidden
// behind — the character they're following, no matter which way the camera faces
function perpFollowOffset(originX, originZ, side, dist) {
  const dirX = camera.position.x - originX, dirZ = camera.position.z - originZ;
  const len = Math.hypot(dirX, dirZ) || 1;
  return [originX + (-dirZ / len) * side * dist, originZ + (dirX / len) * side * dist];
}

// ---- A toy you can throw for your pet to fetch/chase — a ball for a dog, a
// lighter yarn toy for a cat (same physics either way, just scaled down a bit) ----
const BALL_R = 0.28;
let ballState = 'idle';            // idle | flying | onground | carried
const ballVel = new THREE.Vector3();
const ballDogMat = new THREE.MeshStandardMaterial({ color: 0xd7f25a, roughness: 0.6 }); // tennis ball
const ballCatMat = new THREE.MeshStandardMaterial({ color: 0xe85a9a, roughness: 0.85 }); // yarn ball
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 16, 12), ballDogMat);
ball.castShadow = true; ball.visible = false; scene.add(ball);
const _throwDir = new THREE.Vector3();
let ballWaitingSince = 0; // when the toy last landed/needed fetching — used to un-stick a lost toy
function throwBall() {
  if (!player || ballState !== 'idle' || !currentPlayerPet()) return; // one toy at a time, and only with a pet
  ball.material = petCat ? ballCatMat : ballDogMat;
  ball.position.set(player.position.x, player.position.y + 1.4, player.position.z);
  camera.getWorldDirection(_throwDir); _throwDir.y = 0;
  if (_throwDir.lengthSq() === 0) _throwDir.set(0, 0, -1);
  _throwDir.normalize();
  const power = petCat ? 0.55 : 1; // a light yarn toy doesn't arc as far as a tennis ball
  ballVel.copy(_throwDir).multiplyScalar(10 * power); ballVel.y = 7 * power;
  ball.visible = true; ballState = 'flying';
}
function updateBall(dt) {
  if (ballState === 'flying') {
    ballVel.y -= 18 * dt;            // gravity — the same for every toy
    const fromX = ball.position.x, fromZ = ball.position.z;
    ball.position.addScaledVector(ballVel, dt);
    // toys respect walls too — a throw at a house slides along it and lands
    // where the pet can actually reach it (instead of tunneling inside)
    const [bx, bz] = resolveWalls(ball.position.x, ball.position.z, fromX, fromZ, BALL_R);
    ball.position.x = bx; ball.position.z = bz;
    const groundY = houseFloorHeight(ball.position.x, ball.position.z) + BALL_R;
    if (ball.position.y <= groundY) { ball.position.y = groundY; ballState = 'onground'; ballWaitingSince = timer.getElapsed(); }
  } else if (ballState === 'onground' && timer.getElapsed() - ballWaitingSince > 4) {
    // the toy landed somewhere your pet couldn't reach — don't leave the throw
    // button stuck disabled, just let it go (4s: quick enough to feel responsive)
    ballState = 'idle'; ball.visible = false;
  }
}

function updateDog(t, dt) {
  if (!petDog) return;
  const h = petDog.holder;
  // pick a target: play at the pet park, fetch the ball, carry it back, or follow the player
  let tx, tz, speed = 9 * prizeSpeed, keep = 1.6, playing = false;
  const playSpot = petPlayTargetOrNull(petDog, t);
  if (playSpot) { tx = playSpot.x; tz = playSpot.z; speed = 7; keep = 0.7; }
  else if (ballState === 'onground') { tx = ball.position.x; tz = ball.position.z; speed = 12; keep = 0.6; }
  else if (ballState === 'carried') { tx = player ? player.position.x : h.position.x; tz = player ? player.position.z : h.position.z; speed = 12; keep = 1.5; }
  else if (player) {
    [tx, tz] = perpFollowOffset(player.position.x, player.position.z, -1, 0.9); // trail beside the player (opposite side from a child)
    const [wx, wz] = resolveWalls(tx, tz, player.position.x, player.position.z);
    if (wx !== tx || wz !== tz) { tx = player.position.x; tz = player.position.z; } // side spot is inside a wall (doorway) — aim at the player instead
  }
  else { tx = 4; tz = 7; }

  const dx = tx - h.position.x, dz = tz - h.position.z;
  const d = Math.hypot(dx, dz);
  let moving = false;
  if (d > keep) {
    const prevX = h.position.x, prevZ = h.position.z;
    const step = Math.min(speed * dt, d - keep * 0.7);
    h.position.x += (dx / d) * step;
    h.position.z += (dz / d) * step;
    const [rx, rz] = resolveWalls(h.position.x, h.position.z, prevX, prevZ); // don't clip through houses
    h.position.x = rx; h.position.z = rz;
    moving = true;
  } else if (playSpot) { playing = true; } // arrived at the activity — play in place
  h.position.y = houseFloorHeight(h.position.x, h.position.z); // climbs stairs too

  // fetch state transitions (paused while off playing at the pet park)
  if (!playSpot) {
    if (ballState === 'onground' && d <= keep + 0.3) { ballState = 'carried'; }
    if (ballState === 'carried') {
      ball.position.set(h.position.x, h.position.y + 0.55, h.position.z); // in the puppy's mouth
      if (d <= keep + 0.3) { ballState = 'idle'; ball.visible = false; }  // returned to player
    }
  }

  const excited = petDog.reactUntil && t < petDog.reactUntil;
  petDog.mesh.rotation.y = Math.atan2(camera.position.x - h.position.x, camera.position.z - h.position.z);
  petDog.mesh.position.y = petDog.baseY + (playing ? Math.abs(Math.sin(t * 7)) * 0.3 : (moving || excited) ? Math.abs(Math.sin(t * 12)) * 0.2 : Math.sin(t * 2) * 0.06);
}

function updatePlayerCat(t, dt) {
  if (!petCat) return;
  const h = petCat.holder;
  // pick a target: play at the pet park, pounce on the toy, carry it back, or follow the player
  let tx, tz, speed = 9 * prizeSpeed, keep = 1.6, playing = false;
  const playSpot = petPlayTargetOrNull(petCat, t);
  if (playSpot) { tx = playSpot.x; tz = playSpot.z; speed = 7; keep = 0.7; }
  else if (ballState === 'onground') { tx = ball.position.x; tz = ball.position.z; speed = 14; keep = 0.6; } // a quick pounce — faster than the trot
  else if (ballState === 'carried') { tx = player ? player.position.x : h.position.x; tz = player ? player.position.z : h.position.z; speed = 12; keep = 1.5; }
  else if (player) {
    [tx, tz] = perpFollowOffset(player.position.x, player.position.z, -1, 0.9); // trail beside the player (opposite side from a child)
    const [wx, wz] = resolveWalls(tx, tz, player.position.x, player.position.z);
    if (wx !== tx || wz !== tz) { tx = player.position.x; tz = player.position.z; } // side spot is inside a wall (doorway) — aim at the player instead
  }
  else { tx = h.position.x; tz = h.position.z; }

  const dx = tx - h.position.x, dz = tz - h.position.z;
  const d = Math.hypot(dx, dz);
  let moving = false;
  if (d > keep) {
    const prevX = h.position.x, prevZ = h.position.z;
    const step = Math.min(speed * dt, d - keep * 0.7);
    h.position.x += (dx / d) * step;
    h.position.z += (dz / d) * step;
    const [rx, rz] = resolveWalls(h.position.x, h.position.z, prevX, prevZ); // don't clip through houses
    h.position.x = rx; h.position.z = rz;
    moving = true;
  } else if (playSpot) { playing = true; }
  h.position.y = houseFloorHeight(h.position.x, h.position.z);

  // pounce state transitions (paused while off playing at the pet park)
  if (!playSpot) {
    if (ballState === 'onground' && d <= keep + 0.3) { ballState = 'carried'; }
    if (ballState === 'carried') {
      ball.position.set(h.position.x, h.position.y + 0.45, h.position.z); // batted along under the cat
      if (d <= keep + 0.3) { ballState = 'idle'; ball.visible = false; }  // brought back to you
    }
  }

  const excited = petCat.reactUntil && t < petCat.reactUntil;
  petCat.mesh.rotation.y = Math.atan2(camera.position.x - h.position.x, camera.position.z - h.position.z);
  petCat.mesh.position.y = petCat.baseY + (playing ? Math.abs(Math.sin(t * 7)) * 0.3 : (moving || excited) ? Math.abs(Math.sin(t * 12)) * 0.2 : Math.sin(t * 2) * 0.06);
}

// ---------------------------------------------------------------------------
// The doghouse — a little kennel that sits next to your character's home
// (only exists while your pet is a dog).
// ---------------------------------------------------------------------------
let doghouse = null;
const doghouseTarget = new THREE.Vector3(3, 0, 3); // moves to your home when you pick a character
function spawnDoghouse(name) {
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
  const label = makeNameLabel(name || DOG_NAME);
  label.position.set(0, 2.1, 0); label.scale.set(2.0, 0.5, 1);
  g.add(label);
  g.position.set(doghouseTarget.x, 0, doghouseTarget.z);
  scene.add(g);
  doghouse = g;
}
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
const PETPARK = { x: -47, z: -16 }; // pet park near the SW end, between the playground and the pond
const CAFE = { x: -30, z: -34 };    // cozy food shop behind the pond — a free-food social hub
let merryGoRound = null; // the spinning park roundabout
let pondSurface = null;  // the pond water mesh (tap it to fish)
let petParkTrigger = null; // invisible tap-target over the pet park (send your pet to play)
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

// ---------------------------------------------------------------------------
// Your child companion — chosen after picking a character: "<Name> Jr." who
// trails you around (and plays at the playground) just like the neighbor kids.
// ---------------------------------------------------------------------------
let playerKid = null, hasChild = false;
function getCharInfo(id) {
  const r = ((window.SANDYTEN && window.SANDYTEN.roster) || []).find((c) => c.id === id);
  if (r) return r;
  const n1 = (typeof NEIGHBORS !== 'undefined') && NEIGHBORS.find((c) => c.id === id);
  if (n1) return n1;
  const n2 = (typeof NEIGHBORS2 !== 'undefined') && NEIGHBORS2.find((c) => c.id === id);
  if (n2) return n2;
  return null;
}
function spawnPlayerKid(id) {
  const info = getCharInfo(id);
  if (!info || !player) return;
  const kid = spawnRoamer({
    id: id + '_playerkid', name: info.name + ' Jr.', sprite: info.sprite,
    x: player.position.x, z: player.position.z, scale: 0.6,
    child: true, parent: player, lines: ['Wheee!', `Hi, I'm with ${info.name}!`, 'Hehe!'],
  });
  kid.userData.speed = 9;              // keep up with the player, not just an idle-roamer pace
  kid.userData.playArea = 'playground'; // plays on every activity when near the playground, like other kids
  kid.userData.followSide = 1; // trail a step to the side (opposite the pet) so they don't overlap
  playerKid = kid;
}
function removePlayerKid() {
  if (!playerKid) return;
  characterGroup.remove(playerKid);
  const mesh = playerKid.userData.mesh;
  const idx = billboards.indexOf(mesh);
  if (idx !== -1) billboards.splice(idx, 1);
  playerKid = null;
}
function applyChildChoice(want) {
  removePlayerKid();
  hasChild = !!want;
  if (hasChild && playerCharId) spawnPlayerKid(playerCharId);
  if (typeof saveGame === 'function') saveGame();
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
  // the plant itself is tappable too — kids aim at the carrot, not the soil under it
  rec.plant.traverse((o) => { if (o.isMesh) { o.userData.isGarden = true; o.userData.gardenRec = rec; } });
}
function buildGarden() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.9 });
  const g = new THREE.Group(); g.position.set(GARDEN.x, 0, GARDEN.z); scene.add(g);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 2.2), GARDEN_SOIL); bed.position.y = 0.15; bed.receiveShadow = true; g.add(bed);
  for (const dz of [-1.1, 1.1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.42, 0.2), wood); r.position.set(0, 0.21, dz); g.add(r); }
  for (const dx of [-3.25, 3.25]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 2.3), wood); r.position.set(dx, 0.21, 0); g.add(r); }
  const sign = makeSign('GARDEN'); sign.scale.setScalar(0.5); sign.position.set(GARDEN.x, 2.3, GARDEN.z - 1.7); scene.add(sign);
  const plantHint = makeEmojiSprite('🌱'); plantHint.position.set(GARDEN.x, 3.3, GARDEN.z - 1.7); plantHint.visible = true;
  plantHint.scale.set(1.1, 1.1, 1); scene.add(plantHint); // tap-the-soil affordance, same style as the pet park's 🐾
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
  const g3 = prizeGreen ? 6 : 12, g2 = prizeGreen ? 3 : 6; // Green Thumb: crops grow twice as fast
  for (const rec of gardenSpots) {
    if (rec.stage >= 1 && rec.stage < 3) {
      const e = t - rec.plantedAt;
      const ns = e > g3 ? 3 : e > g2 ? 2 : 1;
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
  const fishHint = makeEmojiSprite('🎣'); fishHint.position.set(POND.x, 3.2, POND.z - 6.5); fishHint.visible = true;
  fishHint.scale.set(1.1, 1.1, 1); scene.add(fishHint); // tap-the-pond affordance, same style as the pet park's 🐾

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
  // an invisible tap target over the whole pet park — tap/click it to send your pet to play
  const petParkGround = new THREE.Mesh(new THREE.CircleGeometry(R + 1, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
  petParkGround.rotation.x = -Math.PI / 2; petParkGround.position.set(PETPARK.x, 0.06, PETPARK.z);
  petParkGround.userData.isPetPark = true;
  scene.add(petParkGround); petParkTrigger = petParkGround;
  // a little floating paw print by the sign so kids know they can tap here
  const petParkHint = makeEmojiSprite('🐾'); petParkHint.position.set(PETPARK.x, 3.5, PETPARK.z - 7); petParkHint.visible = true;
  petParkHint.scale.set(1.1, 1.1, 1); scene.add(petParkHint);
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

// ---------------------------------------------------------------------------
// Character unlocks: the first 6 (the original roster) are free from the
// start; these 6 neighbors are LOCKED at first and unlock one at a time as you
// earn XP (stars) — each one costs 100 XP more than the last (100, 200, 300…).
// XP here is a lifetime total (never spent/lost) so it's a milestone to reach,
// separate from the ✨ star balance you spend at the Prize shop.
// ---------------------------------------------------------------------------
const LOCKED_CHARS = [...NEIGHBORS, ...NEIGHBORS2].map((c, i) => ({ ...c, xpNeeded: (i + 1) * 100 }));
let totalXP = 0;                 // lifetime stars earned — a milestone counter, never decreases
const unlockedIds = new Set();   // ids of locked characters unlocked so far
function isCharUnlocked(id) { return !LOCKED_CHARS.some((c) => c.id === id) || unlockedIds.has(id); }

// A cozy open-front cafe behind the pond: warm walls, a striped awning, tables
// with food, and a counter you tap for a free snack. A social hub where roaming
// characters gather to eat. Only the back + side walls collide (open front).
let cafeCounter = null;
function buildCafe() {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffe6c2, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb5794a, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd85a5a, roughness: 0.7 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff4e2, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xe8d4b0, roughness: 1 });
  const W = 12, D = 8, H = 4.2, T = 0.4;
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  box(W, 0.1, D, floorMat, 0, 0.05, 0);                       // patio floor
  [box(W, H, T, wallMat, 0, H / 2, -D / 2), box(T, H, D, wallMat, -W / 2, H / 2, 0), box(T, H, D, wallMat, W / 2, H / 2, 0)].forEach(registerOccluder); // back + sides fade when they hide you
  for (let i = 0; i < 6; i++) box(W / 6, 0.3, D + 0.6, i % 2 ? roofMat : cream, -W / 2 + (i + 0.5) * (W / 6), H + 0.15, 0); // striped awning
  for (const px of [-W / 2 + 0.4, W / 2 - 0.4]) box(0.25, H, 0.25, woodMat, px, H / 2, D / 2 - 0.2); // front posts
  box(W - 3, 1.1, 1.0, woodMat, 0, 0.55, -D / 2 + 1.2);       // counter (tap it for free food)
  const menu = makeSign('MENU'); menu.scale.setScalar(0.32); menu.position.set(0, 2.7, -D / 2 + 0.3); g.add(menu);
  for (const [tx, tz, fe] of [[-3.5, 1.6, '🍔'], [3.5, 1.6, '🍰'], [0, -0.4, '🍦']]) { // tables + stools + food
    box(0.15, 0.75, 0.15, woodMat, tx, 0.38, tz);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 16), cream); top.position.set(tx, 0.8, tz); top.castShadow = true; g.add(top);
    for (const cx of [-1.1, 1.1]) box(0.5, 0.45, 0.5, woodMat, tx + cx, 0.23, tz);
    const s = makeEmojiSprite(fe); s.visible = true; s.scale.set(0.7, 0.7, 1); s.position.set(tx, 1.2, tz); g.add(s);
  }
  const sign = makeSign('CAFE'); sign.position.set(0, H + 1.2, D / 2 - 0.05); g.add(sign);
  const hint = makeEmojiSprite('☕'); hint.visible = true; hint.scale.set(1.3, 1.3, 1); hint.position.set(0, 3.4, D / 2 + 0.6); g.add(hint);
  g.position.set(CAFE.x, 0, CAFE.z); scene.add(g);
  noTreeZones.push({ x: CAFE.x, z: CAFE.z, r: 11 });
  // colliders: back + two sides only (open front so you walk right in)
  addWall(CAFE.x, CAFE.z, 0, -W / 2, -D / 2, W / 2, -D / 2);
  addWall(CAFE.x, CAFE.z, 0, -W / 2, -D / 2, -W / 2, D / 2);
  addWall(CAFE.x, CAFE.z, 0, W / 2, -D / 2, W / 2, D / 2);
  // free-food tap target over the counter
  const trigger = new THREE.Mesh(new THREE.PlaneGeometry(W - 3, 2.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  trigger.rotation.x = -Math.PI / 2; trigger.position.set(CAFE.x, 0.6, CAFE.z - D / 2 + 1.4); trigger.userData.isCafe = true;
  scene.add(trigger); cafeCounter = trigger;
  buildPath(POND.x, POND.z - 5.8, CAFE.x, CAFE.z + D / 2, 2.4);  // a path from the pond down to the cafe
  makeLampPost(CAFE.x - W / 2 - 2, CAFE.z + 2); makeLampPost(CAFE.x + W / 2 + 2, CAFE.z + 2); // warm evening light
}
function buildNeighborhood() {
  // path from the courtyard out to the park
  buildPath(-6, 0, -18, -4); buildPath(-18, -4, PARK.x + 2, PARK.z);
  buildPark();
  buildCafe();
  const R2 = 28;                         // neighbor homes BEHIND the six houses
  const angs = [42, 90, 138];
  NEIGHBORS.forEach((n, i) => {
    const a = angs[i] * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const hx = cs * R2, hz = sn * R2;
    buildHouse({ x: hx, z: hz, rotationY: Math.atan2(-hx, -hz), name: n.name, wall: n.wall, roof: n.roof });
    buildPath(cs * 19, sn * 19, cs * (R2 - 3.6), sn * (R2 - 3.6)); // path behind the six to this home
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
    buildPath(cs * 20, sn * 20, cs * (R3 - 3.6), sn * (R3 - 3.6));
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

// Mini-game win targets — declared here so the quest names below can reference
// them and never desync from the actual win logic in each game.
const SNAKE_WIN = 8; // fruits to eat to win Snake (was 5 — a bit longer now)
const BB_WIN = 5;    // lines to clear to win Block Blast (was 3 — a bit longer now)
const quests = [
  { id: 'coins', name: 'Collect 12 coins', target: 12, prog: 0, reward: 5, done: false },
  { id: 'trade', name: 'Trade with 3 friends', target: 3, prog: 0, reward: 5, done: false },
  { id: 'pet', name: 'Pet a furry friend 3 times 🐾', target: 3, prog: 0, reward: 5, done: false },
  { id: 'fish', name: 'Catch 3 fish 🎣', target: 3, prog: 0, reward: 6, done: false },
  { id: 'crop', name: 'Harvest 4 crops 🥕', target: 4, prog: 0, reward: 6, done: false },
  { id: 'puzzle', name: 'Win the Memory game', target: 1, prog: 0, reward: 10, done: false, puzzle: true, game: 'memory' },
  { id: 'merge', name: 'Win Fruit Merge', target: 1, prog: 0, reward: 10, done: false, puzzle: true, game: 'merge' },
  { id: 'tetris', name: `Clear ${BB_WIN} lines (Block Blast!)`, target: 1, prog: 0, reward: 10, done: false, puzzle: true, game: 'tetris' },
  { id: 'match', name: 'Win Match Pairs', target: 1, prog: 0, reward: 8, done: false, puzzle: true, game: 'match' },
  { id: 'snake', name: `Score ${SNAKE_WIN} in Snake`, target: 1, prog: 0, reward: 10, done: false, puzzle: true, game: 'snake' },
  { id: 'battle', name: 'Win a battle ⚔️', target: 1, prog: 0, reward: 8, done: false },
  { id: 'splash', name: 'Splash in 3 puddles 💦', target: 3, prog: 0, reward: 5, done: false },
  { id: 'sell', name: 'Sell at THE STORE 💰', target: 1, prog: 0, reward: 5, done: false },
  { id: 'camp', name: 'Visit the campsite 🏕️', target: 1, prog: 0, reward: 5, done: false },
  { id: 'dress', name: 'Dress up in the Dressing Room 👗', target: 1, prog: 0, reward: 6, done: false },
  { id: 'prize', name: 'Buy a prize from the shop 🎁', target: 1, prog: 0, reward: 6, done: false },
  { id: 'petpark', name: 'Send your pet to play 🐾', target: 1, prog: 0, reward: 6, done: false },
  { id: 'mallow', name: 'Toast a marshmallow at the fire 🔥', target: 2, prog: 0, reward: 7, done: false },
  { id: 'feed', name: 'Feed 3 friends a snack 🍎', target: 3, prog: 0, reward: 7, done: false },
  { id: 'cafe', name: 'Visit the Cafe by the pond ☕', target: 1, prog: 0, reward: 6, done: false },
  { id: 'hosptour', name: 'Ride the elevator to every hospital floor 🏥', target: HOSP_FLOORS.length, prog: 0, reward: 8, done: false },
  { id: 'stargaze', name: 'Find 3 pictures in the night sky 🔭', target: 3, prog: 0, reward: 8, done: false },
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
function onBattleWon() { questBump('battle'); }
function onSplash() { questBump('splash'); }
function onSell() { questBump('sell'); }
function onVisitCamp() { questBump('camp'); }
function onDressUp() { questBump('dress'); }
function onBuyPrize() { questBump('prize'); }
function onPetParkPlay() { questBump('petpark'); }
function onToastMarshmallow() { questBump('mallow'); }
function resetQuests() {
  for (const q of quests) { q.prog = 0; q.done = false; }
  if (typeof fedFriends !== 'undefined') fedFriends.clear();
  if (typeof hospFloorsVisited !== 'undefined') hospFloorsVisited.clear();
  if (typeof constellations !== 'undefined') constellations.forEach((c) => { c.revealed = false; }); // hide the star pictures again
  if (sideQuest) { scene.remove(sideQuest.item); scene.remove(sideQuest.animal); sideQuest = null; }
  nextSideQuestAt = 25;
  if (questOpen) refreshQuests();
}
function getQuestSave() { return { done: quests.filter((q) => q.done).map((q) => q.id), prog: Object.fromEntries(quests.map((q) => [q.id, q.prog])) }; }
function setQuestSave(s) { for (const q of quests) { if (s.done && s.done.includes(q.id)) q.done = true; if (s.prog && s.prog[q.id] != null) q.prog = s.prog[q.id]; } if (typeof applyStargazeReveals === 'function') applyStargazeReveals(); if (questOpen) refreshQuests(); }

// ---- Quest panel UI ----
let questEl = null, questOpen = false, questListEl = null;
function buildQuestPanel() {
  questEl = document.createElement('div'); questEl.id = 'questpanel'; questEl.style.display = 'none';
  const h = document.createElement('h3'); h.append('🎯 Quests');
  const sub = document.createElement('p'); sub.className = 'shop-sub'; sub.textContent = 'Finish quests to earn ✨ stars & level up!';
  questListEl = document.createElement('div'); questListEl.className = 'shop-list';
  const x = document.createElement('button'); x.className = 'panel-close'; x.textContent = '✕';
  x.addEventListener('click', () => closeQuests());
  questEl.append(x, h, sub, questListEl);
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
function openQuests() { if (typeof tradeOpen !== 'undefined' && tradeOpen) closeTrade(); if (typeof prizeOpen !== 'undefined' && prizeOpen) closePrizes(); if (typeof shopOpen !== 'undefined' && shopOpen) { shopDismissed = true; closeShop(); } questOpen = true; refreshQuests(); questEl.style.display = 'block'; animate(questEl, { opacity: [0, 1], duration: 240, ease: 'out(3)' }); }
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
  keys.clear(); // a held movement key shouldn't keep walking the character behind the modal
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

// ---- Block Blast! (tap a block, tap the board; clear full rows & columns) ----
const BB_N = 8;
const BB_PIECES = [
  [[0, 0]], [[0, 0], [0, 1]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]],
];
const BB_COLORS = ['#ff5a7a', '#6aa6ff', '#74e08c', '#f2c14e', '#b18cff', '#5ad1e0', '#e8881e'];
let tetEl = null, tetOver = true; // public names kept so miniGameActive & the dispatch keep working
let bbGrid = null, bbCells = [], bbTray = [], bbSel = -1, bbLines = 0, bbGridEl = null, bbTrayWrap = null, bbMsg = null;
function buildTetris() {
  tetEl = document.createElement('div'); tetEl.id = 'tetris'; tetEl.className = 'gamemodal'; tetEl.style.display = 'none';
  const panel = document.createElement('div'); panel.className = 'puzzle-panel';
  const h = document.createElement('h3'); h.textContent = '🟦 Block Blast!';
  bbMsg = document.createElement('p'); bbMsg.className = 'puzzle-msg'; bbMsg.textContent = `Drag a block onto the board. Clear ${BB_WIN} lines!`;
  bbGridEl = document.createElement('div'); bbGridEl.className = 'bb-grid';
  for (let i = 0; i < BB_N * BB_N; i++) { const cell = document.createElement('div'); cell.className = 'bb-cell'; const r = Math.floor(i / BB_N), col = i % BB_N; cell.addEventListener('click', () => bbPlace(r, col)); bbGridEl.appendChild(cell); bbCells.push(cell); }
  bbTrayWrap = document.createElement('div'); bbTrayWrap.className = 'bb-tray';
  const close = document.createElement('button'); close.className = 'puzzle-close'; close.textContent = 'Close'; close.addEventListener('click', closeTetris);
  panel.append(h, bbMsg, bbGridEl, bbTrayWrap, close);
  tetEl.appendChild(panel); document.body.appendChild(tetEl);
}
function startTetris() {
  if (!tetEl) buildTetris();
  keys.clear();
  bbGrid = Array.from({ length: BB_N }, () => new Array(BB_N).fill(-1));
  bbLines = 0; bbSel = -1; tetOver = false;
  bbMsg.textContent = `Drag a block onto the board. Clear ${BB_WIN} lines!`;
  bbRefillTray(); bbRenderGrid(); tetEl.style.display = 'flex';
}
function closeTetris() { tetOver = true; tetEl.style.display = 'none'; }
function bbRandomPiece() { return { cells: BB_PIECES[Math.floor(Math.random() * BB_PIECES.length)], color: Math.floor(Math.random() * BB_COLORS.length) }; }
function bbRefillTray() { bbTray = [bbRandomPiece(), bbRandomPiece(), bbRandomPiece()]; bbRenderTray(); }
function bbRenderTray() {
  bbTrayWrap.replaceChildren();
  bbTray.forEach((p, i) => {
    const el = document.createElement('div'); el.className = 'bb-piece' + (i === bbSel ? ' sel' : '');
    if (!p) { el.style.visibility = 'hidden'; bbTrayWrap.appendChild(el); return; }
    let maxR = 0, maxC = 0; p.cells.forEach(([r, c]) => { maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); });
    const mini = document.createElement('div'); mini.className = 'bb-mini'; mini.style.gridTemplateColumns = `repeat(${maxC + 1}, 13px)`;
    for (let r = 0; r <= maxR; r++) for (let c = 0; c <= maxC; c++) { const cell = document.createElement('div'); cell.className = 'bb-mcell'; if (p.cells.some(([pr, pc]) => pr === r && pc === c)) cell.style.background = BB_COLORS[p.color]; mini.appendChild(cell); }
    el.appendChild(mini);
    el.addEventListener('pointerdown', (e) => bbStartDrag(i, e)); // drag to place (a plain tap still selects — fallback)
    bbTrayWrap.appendChild(el);
  });
}
function bbFits(p, r, c) { return p.cells.every(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && rr < BB_N && cc >= 0 && cc < BB_N && bbGrid[rr][cc] < 0; }); }
function bbAnyMove() { return bbTray.some((p) => { if (!p) return false; for (let r = 0; r < BB_N; r++) for (let c = 0; c < BB_N; c++) if (bbFits(p, r, c)) return true; return false; }); }
function bbPlace(r, c) {
  if (tetOver) return;
  if (bbSel < 0 || !bbTray[bbSel]) { bbMsg.textContent = 'Tap a block below first! 👇'; return; }
  const p = bbTray[bbSel];
  if (!bbFits(p, r, c)) { bbMsg.textContent = "Doesn't fit there — try another spot"; return; }
  p.cells.forEach(([dr, dc]) => { bbGrid[r + dr][c + dc] = p.color; });
  bbTray[bbSel] = null; bbSel = -1;
  const fullRows = [], fullCols = [];
  for (let i = 0; i < BB_N; i++) { if (bbGrid[i].every((v) => v >= 0)) fullRows.push(i); if (bbGrid.every((row) => row[i] >= 0)) fullCols.push(i); }
  for (const i of fullRows) for (let cc = 0; cc < BB_N; cc++) bbGrid[i][cc] = -1;
  for (const i of fullCols) for (let rr = 0; rr < BB_N; rr++) bbGrid[rr][i] = -1;
  bbLines += fullRows.length + fullCols.length;
  if (bbLines > 0) bbMsg.textContent = `Lines: ${Math.min(bbLines, BB_WIN)}/${BB_WIN}`;
  if (bbTray.every((x) => !x)) bbRefillTray(); else bbRenderTray();
  bbRenderGrid();
  if (bbLines >= BB_WIN) { tetOver = true; bbMsg.textContent = `${BB_WIN} lines! 🎉`; winMiniGame('tetris'); setTimeout(closeTetris, 1300); return; }
  if (!bbAnyMove()) { tetOver = true; bbMsg.textContent = 'No moves left — Close & retry'; }
}
function bbRenderGrid() { for (let r = 0; r < BB_N; r++) for (let c = 0; c < BB_N; c++) { const v = bbGrid[r][c]; bbCells[r * BB_N + c].style.background = v >= 0 ? BB_COLORS[v] : 'rgba(255,255,255,0.06)'; } }

// ---- Drag a block from the tray onto the board (pointer events; touch-safe) ----
// A plain tap (no drag) still just selects the piece, so the old tap-a-block-
// then-tap-a-cell flow keeps working for little kids who can't drag yet.
let bbDrag = null;
function bbCellSize() { return bbCells[0].getBoundingClientRect().width; }
function bbNearestCell(sx, sy) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < bbCells.length; i++) {
    const rect = bbCells[i].getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const d = (cx - sx) ** 2 + (cy - sy) ** 2;
    if (d < bestD) { bestD = d; best = [Math.floor(i / BB_N), i % BB_N]; }
  }
  return best;
}
function bbClearGhost() { for (const c of bbCells) c.classList.remove('bb-ghost-ok', 'bb-ghost-no'); }
function bbStartDrag(i, e) {
  if (tetOver || !bbTray[i]) return;
  e.preventDefault();
  const p = bbTray[i], cs = bbCellSize(), gap = 3;
  let maxR = 0, maxC = 0; p.cells.forEach(([r, c]) => { maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); });
  const clone = document.createElement('div'); clone.className = 'bb-drag';
  const grid = document.createElement('div'); grid.style.display = 'grid'; grid.style.gap = gap + 'px';
  grid.style.gridTemplateColumns = `repeat(${maxC + 1}, ${cs}px)`;
  for (let r = 0; r <= maxR; r++) for (let c = 0; c <= maxC; c++) {
    const cell = document.createElement('div'); cell.style.width = cs + 'px'; cell.style.height = cs + 'px'; cell.style.borderRadius = '5px';
    if (p.cells.some(([pr, pc]) => pr === r && pc === c)) cell.style.background = BB_COLORS[p.color];
    grid.appendChild(cell);
  }
  clone.appendChild(grid); document.body.appendChild(clone);
  bbDrag = { idx: i, p, clone, cs, gap, pieceW: (maxC + 1) * cs + maxC * gap, pieceH: (maxR + 1) * cs + maxR * gap, moved: false, lastFit: null, downX: e.clientX, downY: e.clientY };
  bbSel = i; bbRenderTray();
  bbMoveDrag(e);
  window.addEventListener('pointermove', bbMoveDrag);
  window.addEventListener('pointerup', bbEndDrag);
  window.addEventListener('pointercancel', bbEndDrag);
}
function bbMoveDrag(e) {
  const d = bbDrag; if (!d) return;
  if (Math.hypot(e.clientX - d.downX, e.clientY - d.downY) > 5) d.moved = true;
  const LIFT = 46; // float the piece above the finger so a kid can see where it lands
  const left = e.clientX - d.pieceW / 2, top = e.clientY - LIFT - d.pieceH;
  d.clone.style.left = left + 'px'; d.clone.style.top = top + 'px';
  bbClearGhost();
  if (!d.moved) { d.lastFit = null; return; }
  const anchor = bbNearestCell(left + d.cs / 2, top + d.cs / 2); // board cell under the piece's top-left
  if (!anchor) { d.lastFit = null; return; }
  const [r, c] = anchor, ok = bbFits(d.p, r, c);
  d.lastFit = ok ? [r, c] : null;
  d.p.cells.forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < BB_N && cc >= 0 && cc < BB_N) bbCells[rr * BB_N + cc].classList.add(ok ? 'bb-ghost-ok' : 'bb-ghost-no'); });
}
function bbEndDrag() {
  window.removeEventListener('pointermove', bbMoveDrag);
  window.removeEventListener('pointerup', bbEndDrag);
  window.removeEventListener('pointercancel', bbEndDrag);
  const d = bbDrag; if (!d) return;
  bbDrag = null; bbClearGhost();
  if (d.moved && d.lastFit) { d.clone.remove(); bbSel = d.idx; bbPlace(d.lastFit[0], d.lastFit[1]); return; }
  if (d.moved) { // dropped somewhere it doesn't fit → spring back to the tray, keep the piece
    const origin = bbTrayWrap.children[d.idx];
    if (origin) { const rect = origin.getBoundingClientRect(); d.clone.style.transition = 'left .16s ease-out, top .16s ease-out, opacity .16s'; d.clone.style.left = rect.left + 'px'; d.clone.style.top = rect.top + 'px'; d.clone.style.opacity = '0'; setTimeout(() => d.clone.remove(), 180); }
    else d.clone.remove();
    return;
  }
  d.clone.remove(); bbSel = d.idx; bbRenderTray(); // a plain tap → just select (tap-to-place fallback)
}
// keyboard for the open mini-game (registered before the movement handler, so it wins)
window.addEventListener('keydown', (e) => {
  if (mergeEl && mergeEl.style.display !== 'none' && !mergeOver) {
    const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (m[e.key]) { e.preventDefault(); mergeMove(m[e.key]); }
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
  keys.clear(); // a held movement key shouldn't keep walking the character behind the modal
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

// ---- Snake (eat 5 fruits to win) — pick your fruit & color, then a 3-2-1-GO start ----
const SNK_N = 13, SNK_CELL = 18;
// many bright, high-contrast choices; all free so any kid plays instantly. each
// fruit has its OWN circle color so the food is unmistakably the chosen fruit,
// even on platforms where canvas emoji render as a plain dark glyph.
const SNAKE_FRUITS = ['🍎', '🍓', '🍒', '🍊', '🍇', '🍉', '🍌', '🥝', '🍑', '🫐', '🍍', '🍈'];
const SNAKE_FRUIT_COLORS = ['#ff5a5a', '#ff4d7a', '#e0334d', '#ffa63a', '#a06cff', '#ff6b6b', '#ffe14a', '#a6e05a', '#ffc07a', '#6a8cff', '#ffd24a', '#c8f06a'];
function snakeFoodColor() { const i = SNAKE_FRUITS.indexOf(snakeFruit); return SNAKE_FRUIT_COLORS[i] || '#ff5a5a'; }
const SNAKE_COLORS = [
  { name: 'Green', head: '#8cf0a4', body: '#4faf54' },
  { name: 'Blue', head: '#8cc4ff', body: '#3a7bd6' },
  { name: 'Pink', head: '#ff9ec7', body: '#e0558a' },
  { name: 'Orange', head: '#ffc07a', body: '#e0872e' },
  { name: 'Purple', head: '#c9a6ff', body: '#8c5ad6' },
  { name: 'Cyan', head: '#8cf0e0', body: '#2eb0b0' },
  { name: 'Yellow', head: '#ffe98c', body: '#e0b82e' },
  { name: 'Red', head: '#ff9e9e', body: '#e0453a' },
];
let snakeEl = null, snakeCanvas = null, snakeCtx = null, snakeMsg = null, snakeBody = null, snakeDir = null, snakeNext = null, snakeFood = null, snakeScore = 0, snakeTimer = 0, snakeOver = true;
let snakeSetupEl = null, snakeGameEl = null, snakeCountEl = null, snakeRunning = false;
const snakeCountTimers = [];
// snakeFruit / snakeColorIdx are declared up near SAVE_KEY (persisted picks)
function snakeColor() { return SNAKE_COLORS[snakeColorIdx] || SNAKE_COLORS[0]; }
function buildSnake() {
  snakeEl = document.createElement('div'); snakeEl.id = 'snake'; snakeEl.className = 'gamemodal'; snakeEl.style.display = 'none';
  const panel = document.createElement('div'); panel.className = 'puzzle-panel';
  const h = document.createElement('h3'); h.textContent = '🐍 Snake';

  // --- setup screen: pick a fruit & a color, then Start ---
  snakeSetupEl = document.createElement('div');
  const fLabel = document.createElement('p'); fLabel.className = 'puzzle-msg'; fLabel.textContent = 'Pick your fruit!';
  const fRow = document.createElement('div'); fRow.className = 'snake-choices';
  SNAKE_FRUITS.forEach((fr) => {
    const b = document.createElement('button'); b.className = 'snake-fruit'; b.textContent = fr;
    b.addEventListener('click', () => { snakeFruit = fr; if (typeof saveGame === 'function') saveGame(); renderSnakeChoices(); });
    fRow.appendChild(b);
  });
  const cLabel = document.createElement('p'); cLabel.className = 'puzzle-msg'; cLabel.textContent = 'Pick your color!';
  const cRow = document.createElement('div'); cRow.className = 'snake-choices';
  SNAKE_COLORS.forEach((col, i) => {
    const b = document.createElement('button'); b.className = 'snake-swatch'; b.title = col.name;
    b.style.background = `linear-gradient(135deg, ${col.head}, ${col.body})`;
    b.addEventListener('click', () => { snakeColorIdx = i; if (typeof saveGame === 'function') saveGame(); renderSnakeChoices(); });
    cRow.appendChild(b);
  });
  const startBtn = document.createElement('button'); startBtn.className = 'snake-start'; startBtn.textContent = '▶ Start!';
  startBtn.addEventListener('click', snakeBeginCountdown);
  snakeSetupEl.append(fLabel, fRow, cLabel, cRow, startBtn);

  // --- game screen: board + d-pad ---
  snakeGameEl = document.createElement('div'); snakeGameEl.style.display = 'none';
  snakeMsg = document.createElement('p'); snakeMsg.className = 'puzzle-msg'; snakeMsg.textContent = `Eat ${SNAKE_WIN} fruits to win!`;
  const canvasWrap = document.createElement('div'); canvasWrap.className = 'snake-canvas-wrap';
  snakeCanvas = document.createElement('canvas'); snakeCanvas.width = SNK_N * SNK_CELL; snakeCanvas.height = SNK_N * SNK_CELL; snakeCanvas.className = 'tet-canvas'; snakeCtx = snakeCanvas.getContext('2d');
  snakeCountEl = document.createElement('div'); snakeCountEl.className = 'snake-count'; snakeCountEl.style.display = 'none';
  canvasWrap.append(snakeCanvas, snakeCountEl);
  const pad = document.createElement('div'); pad.className = 'dpad';
  const mk = (l, dx, dy) => { const b = document.createElement('button'); b.className = 'dpad-btn'; b.textContent = l; b.addEventListener('click', () => snakeTurn([dx, dy])); return b; };
  pad.append(mk('⬅️', -1, 0), mk('⬆️', 0, -1), mk('⬇️', 0, 1), mk('➡️', 1, 0));
  snakeGameEl.append(snakeMsg, canvasWrap, pad);

  const close = document.createElement('button'); close.className = 'puzzle-close'; close.textContent = 'Close'; close.addEventListener('click', closeSnake);
  panel.append(h, snakeSetupEl, snakeGameEl, close);
  snakeEl.appendChild(panel); document.body.appendChild(snakeEl);
}
function renderSnakeChoices() {
  if (!snakeSetupEl) return;
  snakeSetupEl.querySelectorAll('.snake-fruit').forEach((b, i) => b.classList.toggle('sel', SNAKE_FRUITS[i] === snakeFruit));
  snakeSetupEl.querySelectorAll('.snake-swatch').forEach((b, i) => b.classList.toggle('sel', i === snakeColorIdx));
}
function startSnake() {
  if (!snakeEl) buildSnake();
  keys.clear();
  clearSnakeCount();
  clearInterval(snakeTimer);
  snakeOver = true; snakeRunning = false; // nothing moves on the setup screen
  // show the pick-your-fruit-and-color screen — the game does NOT start yet
  snakeSetupEl.style.display = '';
  snakeGameEl.style.display = 'none';
  renderSnakeChoices();
  snakeEl.style.display = 'flex';
}
function snakeBeginCountdown() {
  // reset the board and show it, still, with the food already visible
  snakeBody = [[6, 6], [5, 6], [4, 6]]; snakeDir = [1, 0]; snakeNext = [1, 0]; snakeScore = 0;
  snakeOver = false; snakeRunning = false;
  snakeMsg.textContent = 'Get ready…';
  snakePlaceFood(); snakeDraw();
  snakeSetupEl.style.display = 'none';
  snakeGameEl.style.display = '';
  // big 3 · 2 · 1 · GO! overlay — the snake stays put until GO
  clearSnakeCount();
  const steps = ['3', '2', '1', 'GO!'];
  snakeCountEl.style.display = 'flex';
  const show = (i) => {
    if (i >= steps.length) {
      snakeCountEl.style.display = 'none';
      snakeMsg.textContent = `Fruits: 0/${SNAKE_WIN}`;
      snakeRunning = true;
      clearInterval(snakeTimer); snakeTimer = setInterval(snakeStep, 220);
      return;
    }
    snakeCountEl.textContent = steps[i];
    snakeCountEl.classList.remove('pop'); void snakeCountEl.offsetWidth; snakeCountEl.classList.add('pop');
    snakeCountTimers.push(setTimeout(() => show(i + 1), 650));
  };
  show(0);
}
function clearSnakeCount() { while (snakeCountTimers.length) clearTimeout(snakeCountTimers.pop()); if (snakeCountEl) snakeCountEl.style.display = 'none'; }
function closeSnake() { snakeOver = true; snakeRunning = false; clearInterval(snakeTimer); clearSnakeCount(); snakeEl.style.display = 'none'; }
function snakeTurn(d) { if (d[0] === -snakeDir[0] && d[1] === -snakeDir[1]) return; snakeNext = d; } // no reversing
function snakePlaceFood() {
  do { snakeFood = [Math.floor(Math.random() * SNK_N), Math.floor(Math.random() * SNK_N)]; }
  while (snakeBody.some(([x, y]) => x === snakeFood[0] && y === snakeFood[1]));
}
function snakeStep() {
  if (snakeOver || !snakeRunning) return; // don't move during the countdown
  snakeDir = snakeNext;
  const head = [snakeBody[0][0] + snakeDir[0], snakeBody[0][1] + snakeDir[1]];
  if (head[0] < 0 || head[1] < 0 || head[0] >= SNK_N || head[1] >= SNK_N || snakeBody.some(([x, y]) => x === head[0] && y === head[1])) {
    snakeOver = true; snakeRunning = false; clearInterval(snakeTimer); snakeMsg.textContent = 'Oops! Close & retry'; return;
  }
  snakeBody.unshift(head);
  if (head[0] === snakeFood[0] && head[1] === snakeFood[1]) {
    snakeScore++; snakeMsg.textContent = `Fruits: ${snakeScore}/${SNAKE_WIN}`;
    if (snakeScore >= SNAKE_WIN) { snakeOver = true; snakeRunning = false; clearInterval(snakeTimer); snakeMsg.textContent = `${SNAKE_WIN} fruits! 🎉`; winMiniGame('snake'); setTimeout(closeSnake, 1300); return; }
    snakePlaceFood();
  } else { snakeBody.pop(); }
  snakeDraw();
}
function snakeDraw() {
  const ctx = snakeCtx; ctx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  // FOOD: a bright cream circle (always visible, even where color-emoji don't
  // render on canvas) with the chosen fruit emoji layered on top
  const fx = snakeFood[0] * SNK_CELL + SNK_CELL / 2, fy = snakeFood[1] * SNK_CELL + SNK_CELL / 2;
  ctx.beginPath(); ctx.arc(fx, fy, SNK_CELL / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = snakeFoodColor(); ctx.fill();       // the CHOSEN fruit's own color — unmistakable
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
  ctx.fillStyle = '#ffffff'; // white emoji glyph reads on every fruit color if emoji fall back to monochrome
  ctx.font = `${SNK_CELL - 4}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(snakeFruit, fx, fy);
  // SNAKE: in the chosen color, head lighter than the body
  const col = snakeColor();
  snakeBody.forEach(([x, y], i) => { ctx.fillStyle = i === 0 ? col.head : col.body; ctx.fillRect(x * SNK_CELL + 1, y * SNK_CELL + 1, SNK_CELL - 2, SNK_CELL - 2); });
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
  const wait = prizeRod ? 0.6 + Math.random() * 1.2 : 2 + Math.random() * 3; // Lucky Rod: bites much faster
  fishing = { bobber, until: timer.getElapsed() + wait, base: bobber.position.y };
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
  const x = document.createElement('button'); x.className = 'panel-close'; x.textContent = '✕';
  x.addEventListener('click', () => { shopDismissed = true; closeShop(); }); // stays closed until you walk away & back
  shopEl.append(x, h, sub, list, sellRow, shopMsgEl, ownedEl);
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
  // food is eaten right away (restores hunger + health with a chomp animation)
  if (typeof isFood === 'function' && isFood(item.name)) {
    eatFood(item.name);
    shopMsgEl.textContent = `Yum! You ate ${item.emoji} ${item.name} 😋`;
  } else {
    shopMsgEl.textContent = `You bought ${item.emoji} ${item.name}!`;
  }
  animate(shopMsgEl, { scale: [1.2, 1], opacity: [0.4, 1], duration: 300, ease: 'out(3)' });
  updateOwned();
  refreshShop();
  if (typeof saveGame === 'function') saveGame();
}

function openShop() {
  // the side panels share the right edge — close them so the shop never paints on top of an open one
  if (typeof questOpen !== 'undefined' && questOpen) closeQuests();
  if (typeof prizeOpen !== 'undefined' && prizeOpen) closePrizes();
  if (typeof tradeOpen !== 'undefined' && tradeOpen) closeTrade();
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
  { id: 'green', emoji: '🌱', name: 'Green Thumb', cost: 15, desc: 'Crops grow twice as fast' },
  { id: 'rod', emoji: '🎣', name: 'Lucky Rod', cost: 13, desc: 'Fish bite much faster' },
  { id: 'heart', emoji: '💗', name: 'Heart Charm', cost: 20, desc: '+20 health in battles' },
  { id: 'trail', emoji: '🌈', name: 'Rainbow Trail', cost: 10, desc: 'Sparkles follow you' },
];
let prizeEl = null, prizeOpen = false, prizeListEl = null, prizeBalEl = null;
function buildPrizes() {
  prizeEl = document.createElement('div'); prizeEl.id = 'prizepanel'; prizeEl.style.display = 'none';
  const h = document.createElement('h3'); h.append('🎁 Prizes');
  prizeBalEl = document.createElement('p'); prizeBalEl.className = 'shop-sub';
  prizeListEl = document.createElement('div'); prizeListEl.className = 'shop-list';
  const msg = document.createElement('p'); msg.className = 'shop-msg'; prizeEl._msg = msg;
  const x = document.createElement('button'); x.className = 'panel-close'; x.textContent = '✕';
  x.addEventListener('click', () => closePrizes());
  prizeEl.append(x, h, prizeBalEl, prizeListEl, msg);
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
  if (typeof onBuyPrize === 'function') onBuyPrize(); // quest: buy a prize
  refreshPrizes(); if (typeof saveGame === 'function') saveGame();
}
function openPrizes() { if (typeof questOpen !== 'undefined' && questOpen) closeQuests(); if (typeof tradeOpen !== 'undefined' && tradeOpen) closeTrade(); if (typeof shopOpen !== 'undefined' && shopOpen) { shopDismissed = true; closeShop(); } prizeOpen = true; refreshPrizes(); prizeEl.style.display = 'block'; animate(prizeEl, { opacity: [0, 1], duration: 240, ease: 'out(3)' }); }
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
// Three big bosses, each tougher than the last, each with its own spot so their
// battle prompts never overlap. All within reach of PLAY_RADIUS (58 from origin).
const BOSSES = [
  { id: 'boss', sprite: 'boss.png', name: 'Big Boss Dragon', hp: 90, atk: 9, reward: 25, boss: true,
    pos: { x: 34, z: -31 }, scale: 1.9, lines: ['ROAAR!', 'Face me if you dare!', 'GRRRAH!'] },
  { id: 'boss2', sprite: 'golem.png', name: 'Boulder Golem', hp: 110, atk: 10, reward: 30, boss: true,
    pos: { x: 46, z: -22 }, scale: 2.0, lines: ['...RUMBLE...', 'You dare wake me?', 'CRUMBLE THIS!'] },
  { id: 'boss3', sprite: 'yeti.png', name: 'Frost Yeti', hp: 130, atk: 11, reward: 35, boss: true,
    pos: { x: 50, z: -6 }, scale: 2.1, lines: ['BRRR-OARR!', 'The strongest of all!', 'Feel the chill!'] },
];
const enemies = [];
const ENEMY_AREA = { x: 34, z: -18 };
function spawnEnemies() {
  ENEMIES.forEach((e, i) => {
    const a = (i / ENEMIES.length) * Math.PI * 2;
    const h = spawnCritter({ sprite: e.sprite, name: e.name, lines: ['Grr!', 'Wanna battle?', 'Rawr!'], scale: 0.85, center: ENEMY_AREA, radius: 7, x: ENEMY_AREA.x + Math.cos(a) * 4, z: ENEMY_AREA.z + Math.sin(a) * 4 });
    h.userData.isEnemy = true; h.userData.enemy = e; enemies.push(h);
  });
  // the BIG BOSSES — each bigger & tougher, standing alone at their own spot
  BOSSES.forEach((boss) => {
    const b = spawnCritter({ sprite: boss.sprite, name: boss.name, lines: boss.lines, scale: boss.scale, center: boss.pos, radius: 1.5, x: boss.pos.x, z: boss.pos.z });
    b.userData.isEnemy = true; b.userData.enemy = boss; enemies.push(b);
    const bossSign = makeSign('BOSS'); bossSign.scale.setScalar(0.5); bossSign.position.set(boss.pos.x, 3.4 * boss.scale, boss.pos.z - 4); scene.add(bossSign);
    noTreeZones.push({ x: boss.pos.x, z: boss.pos.z, r: 10 });
  });
  const sign = makeSign('BATTLE!'); sign.scale.setScalar(0.55); sign.position.set(ENEMY_AREA.x, 2.8, ENEMY_AREA.z + 8); scene.add(sign);
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
  if (typeof uiModalOpen === 'function' && uiModalOpen()) { hideBattlePrompt(); return; } // don't pop a Fight prompt over a choice modal
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
  const run = document.createElement('button'); run.className = 'puzzle-close'; run.textContent = '🏃 Run away'; run.addEventListener('click', () => { battleActive = false; battleEl.style.display = 'none'; battlePromptCool = timer.getElapsed() + 6; }); // cooldown so the prompt doesn't instantly re-open
  panel.append(h, eName, eBar, img, pName, pBar, msg, atk, run);
  battleEl.appendChild(panel); document.body.appendChild(battleEl);
}
function openBattle(holder) {
  if (!battleEl) buildBattle();
  keys.clear(); // a held movement key shouldn't keep walking the character behind the battle
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
  if (typeof onBattleWon === 'function') onBattleWon();
  s.holder.userData.defeatedUntil = timer.getElapsed() + 30; s.holder.visible = false;
  setTimeout(() => { if (s.holder) s.holder.visible = true; }, 30000);
  battleActive = false; setTimeout(() => { battleEl.style.display = 'none'; }, 1700);
  if (typeof saveGame === 'function') saveGame();
}
function battleLose() {
  battleEl._msg.textContent = `You fainted! Level up & try again. 💫`;
  battlePromptCool = timer.getElapsed() + 8; // breathing room before the prompt can re-open
  battleActive = false; setTimeout(() => { battleEl.style.display = 'none'; }, 1700);
}
buildBattlePrompt(); buildBattle();

// Open the shop when the player walks up to the shopkeeper.
let shopDismissed = false; // ✕ was tapped — don't auto-reopen until they leave and come back
function updateShop() {
  let near = false;
  if (player) {
    const dx = player.position.x - SHOPKEEPER_POS.x;
    const dz = player.position.z - SHOPKEEPER_POS.z;
    near = (dx * dx + dz * dz) < 5.5 * 5.5;
  }
  if (!near) shopDismissed = false;
  if (near && !shopOpen && !shopDismissed) openShop();
  else if (!near && shopOpen) closeShop();
}

// ---------------------------------------------------------------------------
// DRESSING ROOM — walk in to buy accessories and style your character.
// Accessories are little sprites layered over the character's head/face.
// ---------------------------------------------------------------------------
const DRESS_CENTER = new THREE.Vector3(-22, 0, -16); // spaced out to the west
const DRESS_POS = new THREE.Vector3(-22, 0, -12.5);  // where you stand to style

function buildDressingRoom() {
  const room = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe7c6e0, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8e6fb0, roughness: 0.8 });
  const mirrorFrame = new THREE.MeshStandardMaterial({ color: 0xb98bd6, roughness: 0.7 });
  const mirrorGlass = new THREE.MeshStandardMaterial({ color: 0xd9f0ff, emissive: 0x9fd8ff, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.2 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xead2e6, roughness: 1 });

  const W = 8, D = 6, H = 4.8, T = 0.4, DOOR = 4; // tall enough that a 3.4-unit character clears the door lintel
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
  parts.forEach((m) => { if (m.position.y > 0.2) registerOccluder(m); }); // walls/roof fade when they hide you

  const sign = makeSign('DRESSING ROOM');
  sign.position.set(0, H + 1.3, D / 2 - 0.05);
  room.add(sign);

  room.position.copy(DRESS_CENTER);
  scene.add(room);
  // smaller no-tree zone so trees can nestle close (footprint half-diagonal ≈5)
  noTreeZones.push({ x: DRESS_CENTER.x, z: DRESS_CENTER.z, r: 6.5 });
  // plant a cozy grove hugging the SIDES & BACK of the dressing room — the door
  // faces +z and the path comes from the NE, so keep the front (+z) & NE clear
  const DC = DRESS_CENTER;
  const grove = [
    [-6.5, 2.5], [-6, -0.5], [-6, -3.5],  // west side (front-corner back to rear)
    [-2.5, -5.5], [1, -6], [4.5, -5.5],   // back (behind the room, -z)
    [6.3, -1.5], [6, -4.5],               // east side toward the back
  ];
  grove.forEach(([dx, dz], i) => loadModel(TREE_FILES[i % TREE_FILES.length], { position: [DC.x + dx, 0, DC.z + dz], rotationY: i * 1.3, scale: 1.9 + (i % 3) * 0.3 }));
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
function resolveWalls(x, z, fromX, fromZ, radius = PLAYER_RADIUS) {
  for (const s of wallSegments) {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
    const L2 = dx * dx + dz * dz || 1;
    let t = ((x - s.x1) * dx + (z - s.z1) * dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = s.x1 + t * dx, cz = s.z1 + t * dz;
    let ox = x - cx, oz = z - cz;
    let d = Math.hypot(ox, oz);
    if (d < radius) {
      if (d < 1e-4) {
        // degenerate case (standing exactly ON the wall line): push a full
        // radius BACK the way the mover came — the old code pushed along the
        // movement direction, tunneling them through to the far side
        const bx = fromX - x, bz = fromZ - z;
        const bl = Math.hypot(bx, bz) || 1;
        x += (bx / bl) * radius; z += (bz / bl) * radius;
      } else {
        ox /= d; oz /= d;
        const push = radius - d;
        x += ox * push; z += oz * push;
      }
    }
  }
  return [x, z];
}

// Walls for the PUBLIC buildings (store, hospital, dressing room) — same
// 5-segment doorway pattern the houses use. These are registered here (not in
// their build functions) because those run before wallSegments exists above.
for (const b of [
  { x: STORE_POS.x, z: STORE_POS.z, W: 9, D: 6, DOOR: 4 },                    // THE STORE
  { x: HOSP_POS.x, z: HOSP_POS.z, W: HOSP_W, D: HOSP_D, DOOR: HOSP_DOOR },    // HOSPITAL (big)
  { x: DRESS_CENTER.x, z: DRESS_CENTER.z, W: 8, D: 6, DOOR: 4 },              // DRESSING ROOM
]) {
  addWall(b.x, b.z, 0, -b.W / 2, -b.D / 2, b.W / 2, -b.D / 2);   // back
  addWall(b.x, b.z, 0, -b.W / 2, -b.D / 2, -b.W / 2, b.D / 2);   // left
  addWall(b.x, b.z, 0, b.W / 2, -b.D / 2, b.W / 2, b.D / 2);     // right
  addWall(b.x, b.z, 0, -b.W / 2, b.D / 2, -b.DOOR / 2, b.D / 2); // front, left of door
  addWall(b.x, b.z, 0, b.DOOR / 2, b.D / 2, b.W / 2, b.D / 2);   // front, right of door
}
// The fountain basin (r≈2.4 at the courtyard center) — an octagon of segments.
for (let i = 0; i < 8; i++) {
  const a1 = (i / 8) * Math.PI * 2, a2 = ((i + 1) / 8) * Math.PI * 2, FR = 2.45;
  wallSegments.push({ x1: Math.cos(a1) * FR, z1: Math.sin(a1) * FR, x2: Math.cos(a2) * FR, z2: Math.sin(a2) * FR });
}
// Campsite tents — a small square collider per tent, from the SAME horseshoe
// layout the visuals use (so they line up), and slightly smaller than before so
// the square doesn't jut past the round cone and cause "bump into nothing".
campTentLayout().forEach((t) => {
  const spots = [{ x: t.tx, z: t.tz, r: CAMP_TENT_COLL }];
  if (t.kid) spots.push({ x: t.kid.x, z: t.kid.z, r: CAMP_KIDTENT_COLL });
  for (const s of spots) {
    addWall(s.x, s.z, 0, -s.r, -s.r, s.r, -s.r);
    addWall(s.x, s.z, 0, -s.r, s.r, s.r, s.r);
    addWall(s.x, s.z, 0, -s.r, -s.r, -s.r, s.r);
    addWall(s.x, s.z, 0, s.r, -s.r, s.r, s.r);
  }
});

// House dimensions + the stairs/loft layout (shared with houseFloorHeight).
// Sized so a 3.4-unit character actually FITS: the door opening (H1 - 0.5
// lintel = 3.7) clears their head, and the bigger footprint gives the camera
// something to see inside (walls also fade via the occlusion system).
const HOUSE_W = 6.5, HOUSE_D = 6.5, HOUSE_T = 0.35, HOUSE_DOOR = 2.6;
const HOUSE_H1 = 4.2, HOUSE_H2 = 3.0;
const LOFT_Y = HOUSE_H1 + 0.1;                 // height you stand at on the loft
const STAIR_FRONT_Z = 1.3, STAIR_BACK_Z = -0.6; // stairs run between these (local z)
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
  parts.forEach((m) => { if (m.position.y > 0.2) registerOccluder(m); }); // walls/roof/loft fade when they hide you (not the ground slab)

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
  noTreeZones.push({ x, z, r: 6.5 });

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
    doghouseSpotById[c.id] = { x: cs * (R - 4.8) + px * 2.6, z: sn * (R - 4.8) + pz * 2.6 }; // clear of the bigger house front
    buildPath(cs * 3, sn * 3, cs * (R - 3.6), sn * (R - 3.6));    // path out to this house (stops at the wider wall)
  });
  // paths to THE STORE, the DRESSING ROOM, and the HOSPITAL
  buildPath(0, -3, STORE_POS.x, STORE_POS.z + 3);
  buildPath(-2.8, -2.1, DRESS_POS.x, DRESS_POS.z);
  buildPath(3, -3, HOSP_POS.x, HOSP_POS.z + HOSP_D / 2);   // out to the big hospital's front door
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

// ---------------------------------------------------------------------------
// 🌌 The NEBULA NIGHT SKY — one rigid, camera-centered group holding a painted
// nebula dome, three layers of gently twinkling stars, and connect-the-dots
// constellations you discover through the campsite telescope.
// One rigid group = no double-parallax tearing; re-centered on the camera every
// frame = the stars behave as if infinitely far away. Radius 1600 sits beyond
// the moon (1300) and inside camera.far (2000), so the moon stays IN FRONT.
// Everything here is fog:false (FogExp2 would paint it fog-gray at this range),
// toneMapped:false (so the night exposure dip doesn't double-dim it), and
// depthWrite:false. Painted ONCE at load — never re-uploaded per frame.
// ---------------------------------------------------------------------------
const nightSky = new THREE.Group();
scene.add(nightSky);
const SKY_R = 1600;
function paintNebulaTexture() {
  const W = document.body.classList.contains('touch') ? 1024 : 2048, H = W / 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  let seed = 31; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  // NOTE on layout: the chase camera can only see the sky band from the horizon
  // (v=0.5) up to ~30° above it (v≈0.33) — maxPolarAngle stops the camera at
  // ground level. So the nebula lives in v 0.16–0.48, thickest right where kids
  // actually look, and the horizon fade starts BELOW that band (v 0.46).
  // pastel nebula wisps (purple / pink / teal — clearly there, still below lamp glow)
  const tints = ['138,108,255', '255,138,212', '111,195,201', '158,130,255', '255,170,190'];
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = H * (0.16 + rnd() * 0.30), r = (0.07 + rnd() * 0.13) * W;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tint = tints[i % tints.length], a = 0.22 + rnd() * 0.20;
    g.addColorStop(0, `rgba(${tint},${a})`); g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // a glowing milky-way band arcing through the visible sky
  for (let i = 0; i < 56; i++) {
    const bx = (i / 56) * W, by = H * 0.34 + Math.sin(i * 0.5) * H * 0.08 + (rnd() - 0.5) * H * 0.04;
    const r = (0.02 + rnd() * 0.035) * W;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, 'rgba(225,222,255,0.17)'); g.addColorStop(1, 'rgba(225,222,255,0)');
    ctx.fillStyle = g; ctx.fillRect(bx - r, by - r, r * 2, r * 2);
  }
  // hundreds of baked stars (the twinklers are separate Points layers)
  for (let i = 0; i < 620; i++) {
    const x = rnd() * W, y = rnd() * H * 0.48, s = 0.4 + rnd() * 1.3;
    const warm = rnd();
    ctx.fillStyle = warm < 0.12 ? 'rgba(255,230,190,0.9)' : warm < 0.24 ? 'rgba(190,215,255,0.9)' : 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  // fade out just under the horizon (hides the dome's lower edge; the ground
  // covers everything below it anyway)
  const fade = ctx.createLinearGradient(0, H * 0.46, 0, H * 0.53);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade; ctx.fillRect(0, H * 0.46, W, H * 0.07);
  ctx.fillRect(0, H * 0.53, W, H * 0.47);
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const skyDomeMat = new THREE.MeshBasicMaterial({
  map: paintNebulaTexture(), transparent: true, opacity: 0, side: THREE.BackSide,
  fog: false, toneMapped: false, depthWrite: false,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 20), skyDomeMat);
skyDome.renderOrder = -6; // behind every other transparent thing
nightSky.add(skyDome);
// a soft round dot texture so twinkling stars aren't hard squares
function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
const skyDotTex = makeDotTexture();
// three star layers with different sizes & twinkle phases (slow gentle sine —
// never to zero, never a strobe)
const skyStarLayers = [];
for (const [count, size, spd, ph] of [[260, 2.2, 1.9, 0], [220, 3.2, 2.4, 2.1], [90, 4.6, 1.5, 4.2]]) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * Math.PI * 2, v = Math.random();
    const phi = Math.acos(1 - v * 0.92); // whole sky, right down to the treetops
    pos[i * 3] = SKY_R * 0.94 * Math.sin(phi) * Math.cos(u);
    pos[i * 3 + 1] = SKY_R * 0.94 * Math.cos(phi);
    pos[i * 3 + 2] = SKY_R * 0.94 * Math.sin(phi) * Math.sin(u);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size, sizeAttenuation: false, map: skyDotTex, alphaTest: 0.05,
    transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = -5; pts.userData = { spd, ph };
  nightSky.add(pts); skyStarLayers.push(pts);
}
// ---- Constellations: bright dots + hidden connect-the-dots lines ----
// az/el in degrees → a point on the sky sphere
function skyPoint(azDeg, elDeg, r = SKY_R * 0.92) {
  const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
  return new THREE.Vector3(r * Math.cos(el) * Math.cos(az), r * Math.sin(el), r * Math.cos(el) * Math.sin(az));
}
// each shape: name, sky position, dot offsets [dAz, dEl], and line pairs.
// Elevations sit at 20-24° — the chase camera maxes out ~30° above the horizon
// (maxPolarAngle stops at ground level), so this is the band kids actually see.
const CONSTELLATION_DEFS = [
  { key: 'heart', name: 'the Heart', az: 205, el: 22, pts: [[0, 8], [-6, 12], [-10, 8], [-9, 1], [0, -9], [9, 1], [10, 8], [6, 12]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]] },
  { key: 'dipper', name: 'the Big Dipper', az: 320, el: 24, pts: [[-14, 6], [-8, 8], [-3, 6], [2, 3], [4, -3], [11, -4], [10, 2]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
  { key: 'cat', name: 'the Kitty', az: 80, el: 20, pts: [[-8, 8], [-5, 3], [5, 3], [8, 8], [4, 6], [-4, 6], [-6, -4], [6, -4], [0, -7]], lines: [[0,1],[0,5],[3,2],[3,4],[1,6],[6,8],[8,7],[7,2],[1,2]] },
  { key: 'dog', name: 'the Puppy', az: 80, el: 20, pts: [[-9, 6], [-6, 1], [-7, 9], [6, 2], [9, 4], [5, -5], [-5, -5], [0, -2]], lines: [[2,0],[0,1],[1,6],[6,7],[7,5],[5,3],[3,4],[1,3]] },
];
const constellations = CONSTELLATION_DEFS.map((def) => {
  const group = new THREE.Group();
  const dots = [];
  for (const [dAz, dEl] of def.pts) dots.push(skyPoint(def.az + dAz, def.el + dEl * 0.7)); // squash vertically to fit the visible band
  const dotGeo = new THREE.BufferGeometry().setFromPoints(dots);
  const dotMat = new THREE.PointsMaterial({
    color: 0xffe9a0, size: 10, sizeAttenuation: false, map: skyDotTex, alphaTest: 0.05,
    transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false,
  });
  const dotPts = new THREE.Points(dotGeo, dotMat); dotPts.renderOrder = -4; group.add(dotPts);
  const linePts = [];
  for (const [a, b] of def.lines) { linePts.push(dots[a], dots[b]); }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xbfe0ff, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat); lines.renderOrder = -4; group.add(lines);
  nightSky.add(group);
  const center = skyPoint(def.az, def.el);
  return { key: def.key, name: def.name, group, dotMat, lineMat, center, revealed: false };
});
// the third picture in the sky matches your pet (a puppy or a kitty)
function activeConstellations() {
  const petShape = (typeof petKind !== 'undefined' && petKind === 'dog') ? 'dog' : 'cat';
  return constellations.filter((c) => c.key === 'heart' || c.key === 'dipper' || c.key === petShape);
}
// re-reveal the first N pictures after loading a save (N = quest progress)
function applyStargazeReveals() {
  const q = quests.find((x) => x.id === 'stargaze');
  const n = q ? q.prog : 0;
  constellations.forEach((c) => { c.revealed = false; });
  activeConstellations().slice(0, n).forEach((c) => { c.revealed = true; });
}
let nightIntroShown = false; // one "look up!" nudge per session, the first time night falls
// ---- 🔭 the stargazing telescope at the campsite ----
let telescopeTrigger = null;
function buildTelescope() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x8892a0, roughness: 0.4, metalness: 0.5 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd8b46a, roughness: 0.35, metalness: 0.6 });
  for (const a of [0, 2.1, 4.2]) { // tripod legs
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), metal);
    leg.position.set(Math.cos(a) * 0.42, 0.72, Math.sin(a) * 0.42);
    leg.rotation.z = Math.cos(a) * 0.32; leg.rotation.x = -Math.sin(a) * 0.32;
    leg.castShadow = true; g.add(leg);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 1.3, 12), brass);
  tube.position.y = 1.55; tube.rotation.z = -0.75; // aimed up at the stars
  tube.castShadow = true; g.add(tube);
  const eye = makeEmojiSprite('🔭'); eye.visible = true; eye.scale.set(0.9, 0.9, 1); eye.position.set(0, 2.5, 0); g.add(eye);
  g.position.set(CAMP.x + 6, 0, CAMP.z + 6); // campsite edge, clear of the tents
  scene.add(g);
  // a generous flat tap-pad around the tripod
  telescopeTrigger = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  telescopeTrigger.rotation.x = -Math.PI / 2; telescopeTrigger.position.set(CAMP.x + 6, 0.6, CAMP.z + 6);
  telescopeTrigger.userData.isTelescope = true;
  scene.add(telescopeTrigger);
}
buildTelescope();
// tap the telescope at night → reveal the next star picture (one-time each)
function tapTelescope() {
  if (!isNight) { if (typeof questToast === 'function') questToast('The stars come out at night — come back then! 🌙🔭'); return; }
  const next = activeConstellations().find((c) => !c.revealed);
  if (!next) { if (typeof questToast === 'function') questToast('You found ALL the pictures in the stars! 🌌✨'); return; }
  next.revealed = true;
  if (typeof playDing === 'function') playDing();
  if (typeof questToast === 'function') questToast(`🔭 You found ${next.name} in the stars! ⭐`);
  if (typeof questBump === 'function') questBump('stargaze'); // bump BEFORE the save below captures it
  if (typeof addStars === 'function') addStars(1);            // (addStars also saves)
  if (typeof saveGame === 'function') saveGame();             // the reveal must survive a reload
  // gently swing the view toward the discovery: a modest target lift tilts the
  // camera up without fighting the ground clamp, then eases back to normal
  if (player) {
    const dir = next.center.clone().setY(0).normalize(); // face its compass direction
    const look = player.position.clone().addScaledVector(dir, 10);
    animate(controls.target, { x: look.x, y: 9, z: look.z, duration: 1400, ease: 'inOut(2)' });
    setTimeout(() => { if (player) animate(controls.target, { x: player.position.x, y: 1.5, z: player.position.z, duration: 1100, ease: 'inOut(2)' }); }, 4200);
  }
}

const _dayFog = new THREE.Color(0xbfd8ef), _nightFog = new THREE.Color(0x0a1326);
let nextLampSortAt = 0, lampNearest = []; // lamp-pool sort is throttled (allocation-free frames between)
function phaseName(dt) {
  if (dt < 0.05) return ['dawn', '🌅'];
  if (dt < 0.20) return ['morning', '🌄'];
  if (dt < 0.44) return ['day', '☀️'];
  if (dt < 0.52) return ['sunset', '🌇'];
  if (dt < 0.84) return ['night', '🌙'];
  return ['midnight', '🌌'];
}
let dayTimeSkew = 0; // shifts the day/night clock (tests + a future "sleep to skip night")
function updateDayNight(t) {
  const dayT = ((((t / DAY_LENGTH) + DAY_START + dayTimeSkew) % 1) + 1) % 1;
  const sinE = Math.sin(2 * Math.PI * dayT);
  setSun(75 * sinE, 70 + dayT * 220);          // elevation rises & sets; azimuth sweeps
  // biased so daytime is a long bright plateau and night is shorter (gets dark slower)
  const dayness = Math.max(0, Math.min(1, sinE * 1.7 + 0.5)); // 0 deep night … 1 high noon
  sunLight.intensity = 0.1 + dayness * 0.56; // softer daytime sun (morning isn't so bright)
  hemi.intensity = 0.2 + dayness * 0.42;
  // keep daytime exposure modest so the sky shows its blue and white sprites
  // (like Boo) don't blow out; night stays a touch brighter for playability.
  renderer.toneMappingExposure = 0.46 + dayness * 0.17;
  scene.fog.color.copy(_nightFog).lerp(_dayFog, dayness);
  // 🌌 nebula sky: fades in past sunset, hides behind rain clouds, twinkles gently
  const nightAmt = Math.max(0, 1 - dayness * 3) * (1 - (typeof rainAmt !== 'undefined' ? rainAmt : 0));
  nightSky.position.copy(camera.position);       // stars are "infinitely far" — never any parallax
  nightSky.rotation.y = t * 0.000145;            // the whole sky drifts ~0.5°/min, like the real one
  skyDomeMat.opacity = nightAmt * 0.62;          // pastel wisps stay dimmer than lamps & campfire
  const twinkleFrozen = (typeof qualityLevel !== 'undefined' && qualityLevel === 0); // low tier: still pretty, just static
  for (const L of skyStarLayers) {
    L.material.opacity = nightAmt * (twinkleFrozen ? 0.85 : (0.85 + 0.15 * Math.sin(t * L.userData.spd + L.userData.ph)));
  }
  const petShape = (typeof petKind !== 'undefined' && petKind === 'dog') ? 'dog' : 'cat';
  for (const cst of constellations) {
    const active = cst.key === 'heart' || cst.key === 'dipper' || cst.key === petShape;
    cst.group.visible = active;
    cst.dotMat.opacity = nightAmt * 0.95;
    cst.lineMat.opacity = cst.revealed ? nightAmt * 0.55 : 0; // hidden until the telescope reveals them
  }
  isNight = dayness < 0.12;
  // one gentle nudge the first time night falls, so kids discover the sky at all
  if (isNight && !nightIntroShown && player && typeof questToast === 'function') {
    nightIntroShown = true;
    questToast('🌌 Look up! Drag the view up to see the stars — and try the telescope at camp! 🔭');
  }
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
  // (re-sorted twice a second, not every frame — .map().sort() allocates)
  if (lampOn > 0.01 && lampPosts.length) {
    if (t >= nextLampSortAt) {
      nextLampSortAt = t + 0.5;
      const cx = controls.target.x, cz = controls.target.z;
      lampNearest = lampPosts
        .map((lp) => ({ lp, d: (lp.x - cx) ** 2 + (lp.z - cz) ** 2 }))
        .sort((a, b) => a.d - b.d);
    }
    const nearest = lampNearest;
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
  // mostly sunny, with the occasional short rain shower
  if (t > nextWeatherAt) {
    if (weather === 'rainy') { weather = 'sunny'; nextWeatherAt = t + 70 + Math.random() * 70; }       // sunny for a good while after rain
    else { weather = Math.random() < 0.3 ? 'rainy' : 'sunny'; nextWeatherAt = t + (weather === 'rainy' ? 22 + Math.random() * 16 : 45 + Math.random() * 45); }
  }
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
        if (typeof onSplash === 'function') onSplash();
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
  // `anchor` picks which per-character landmark this item sits on (see CHAR_FIT),
  // and `dy` nudges it up/down from that landmark. This is what makes clothes fit
  // every character (whose head/torso sit at different heights in their sprite).
  // accessories — fixed colors, sit on the head/face
  { id: 'crown', name: 'Crown', emoji: '👑', price: 15, anchor: 'hat', dy: 0.15, scale: 1.7, recolor: false, layer: 3 },
  { id: 'hat', name: 'Party Hat', emoji: '🎉', price: 6, anchor: 'hat', dy: 0.28, scale: 1.7, recolor: false, layer: 3 },
  { id: 'glasses', name: 'Sunglasses', emoji: '🕶️', price: 8, anchor: 'eyes', dy: 0, scale: 1.5, recolor: false, layer: 3 },
  { id: 'bow', name: 'Bow', emoji: '🎀', price: 5, anchor: 'hat', dy: -0.05, scale: 1.2, recolor: false, layer: 3 },
  // clothes — white base, recolor them to any color to make your own outfit.
  // Tops cover the torso; bottoms cover the legs; tops draw over bottoms.
  { id: 'tshirt', name: 'T-Shirt', emoji: '👕', price: 7, anchor: 'top', dy: 0, scale: 1.4, recolor: true, layer: 2 },
  { id: 'croptop', name: 'Crop Top', emoji: '🎽', price: 7, anchor: 'top', dy: 0.12, scale: 1.2, recolor: true, layer: 2 },
  { id: 'skirt', name: 'Skirt', emoji: '👗', price: 8, anchor: 'bot', dy: 0.12, scale: 1.5, recolor: true, layer: 1 },
  { id: 'shorts', name: 'Shorts', emoji: '🩳', price: 6, anchor: 'bot', dy: 0, scale: 1.4, recolor: true, layer: 1 },
  { id: 'pants', name: 'Pants', emoji: '👖', price: 9, anchor: 'bot', dy: 0, scale: 1.4, recolor: true, layer: 1 },
  { id: 'rippedpants', name: 'Ripped Pants', emoji: '👖', price: 11, anchor: 'bot', dy: 0, scale: 1.4, recolor: true, layer: 1 },
];
// Per-character fit: the plane-Y (the char plane spans -1.7..+1.7) where each
// accessory landmark sits. Kiki/Spike carry their faces lower in the sprite;
// Bronte/Cliff/Boo/Lloyd carry them higher. Tuned by eye and verified in-browser.
const CHAR_FIT = {
  kiki:    { hat: 0.98, eyes: 0.42, top: -0.10, bot: -1.02 },
  bronte:  { hat: 1.18, eyes: 0.66, top:  0.06, bot: -0.95 },
  spike:   { hat: 0.92, eyes: 0.38, top: -0.08, bot: -1.02 },
  cliff:   { hat: 1.08, eyes: 0.66, top:  0.14, bot: -1.00 },
  boo:     { hat: 1.28, eyes: 0.70, top:  0.04, bot: -0.95 },
  lloyd:   { hat: 1.20, eyes: 0.60, top:  0.06, bot: -1.02 },
  _default:{ hat: 1.05, eyes: 0.52, top: -0.02, bot: -1.00 },
};
function charFit(charMesh) {
  const id = charMesh && charMesh.userData && charMesh.userData.char && charMesh.userData.char.id;
  return (id && CHAR_FIT[id]) || CHAR_FIT._default;
}
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
  // sit on this character's own landmark for that item (so it fits every
  // character), nudged by the item's dy; hug the body (small z), and paint
  // strictly by layer so tops cover bottoms
  const fit = charFit(charMesh);
  const y = (item.anchor && fit[item.anchor] != null ? fit[item.anchor] : (item.y || 0)) + (item.dy || 0);
  m.position.set(0, y, 0.02 + layer * 0.01);
  m.renderOrder = 10 + layer;
  charMesh.add(m);
  charMesh.userData.accessories[item.id] = m;
  if (item.recolor) charMesh.userData.itemColors[item.id] = color;
  if (typeof onDressUp === 'function') onDressUp(); // quest: dress up in the dressing room
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
  const x = document.createElement('button'); x.className = 'panel-close'; x.textContent = '✕';
  x.addEventListener('click', () => { dressDismissed = true; closeDress(); }); // stays closed until you walk away & back (same as the shop)
  dressEl.append(x, h, sub, dressListEl, dressMsgEl);
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

let dressDismissed = false; // ✕ was tapped — don't auto-reopen until they leave and come back
function updateDress() {
  let near = false;
  if (player) {
    const dx = player.position.x - DRESS_POS.x;
    const dz = player.position.z - DRESS_POS.z;
    near = (dx * dx + dz * dz) < 5.5 * 5.5;
  }
  if (!near) dressDismissed = false;
  if (near && !dressOpen && !dressDismissed) openDress();
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
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return; // typing (e.g. naming your pet) — don't move/act
  if (typeof miniGameActive === 'function' && miniGameActive()) return; // let the open mini-game take the keys
  if (typeof uiModalOpen === 'function' && uiModalOpen()) {
    if (e.code === 'Escape' && playerCharId && pickerEl && pickerEl.style.display === 'flex') hidePicker(); // Esc cancels an accidental character change
    keys.clear();
    return; // a choice modal is up — the world shouldn't move underneath it
  }
  if (MOVE_KEYS[e.code]) { keys.add(MOVE_KEYS[e.code]); e.preventDefault(); }
  if (e.code === 'Space') { e.preventDefault(); throwBall(); } // throw the toy for your pet
});
window.addEventListener('keyup', (e) => {
  if (MOVE_KEYS[e.code]) keys.delete(MOVE_KEYS[e.code]);
});
// Stop drifting if focus leaves the page mid-press.
window.addEventListener('blur', () => keys.clear());

// Throw button (works on touch + desktop) — shows for either a dog or a cat
const throwBtnEl = document.getElementById('throwBtn');
if (throwBtnEl) throwBtnEl.addEventListener('click', throwBall);
function updateThrowBtnVisibility() {
  if (!throwBtnEl) return;
  throwBtnEl.style.display = currentPlayerPet() ? '' : 'none';
  throwBtnEl.textContent = petCat ? '🧶' : '🎾';
  throwBtnEl.title = petCat ? 'Throw the toy (Space)' : 'Throw the ball (Space)';
}
updateThrowBtnVisibility(); // hidden until you have a pet

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
    knob.style.transform = `translate(${dx}px, ${dy}px)`; // the knob still tracks the thumb…
    if (len < R * 0.18) { joyVec.x = 0; joyVec.y = 0; }    // …but a resting thumb (deadzone) doesn't jitter-walk
    else { joyVec.x = dx / R; joyVec.y = dy / R; }
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
  updateAmbulance(t, dt);
  updateBall(dt);
  updateDog(t, dt);
  updatePlayerCat(t, dt);
  updateDoghouse(dt);
  updateBalloons(t);

  // Move first (player walks / free camera), then update characters' facing & bob.
  if (player) updatePlayer(dt); else updateMovement(dt);

  updateCollectibles(t, dt);
  updateTrail(t, dt);
  updateStats(t, dt);
  updateShop();
  updateElevator();
  updateDress();
  updateTrades(t);
  updateSideQuests(t);
  updateGarden(t);
  updateFishing(t);
  updateEnemies(t);
  // lantern prize: a warm light that follows you (brightest at night)
  if (player) { lanternLight.position.set(player.position.x, 2.4, player.position.z); lanternLight.intensity = prizeLantern ? (isNight ? 5 : 1.5) : 0; }
  if (player && Math.hypot(player.position.x - CAMP.x, player.position.z - CAMP.z) < 13) onVisitCamp(); // campsite quest
  if (player && Math.hypot(player.position.x - CAFE.x, player.position.z - CAFE.z) < 8 && typeof questBump === 'function') questBump('cafe'); // visit-the-cafe quest
  updateCafeLife(t); // roaming characters nibble a snack when they gather at the cafe
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
        // trail the parent around (and into the park); the player's own child
        // gets a small camera-relative sideways offset so it doesn't stack on a pet/parent
        let px = w.parent.position.x, pz = w.parent.position.z;
        if (w.followSide) {
          [px, pz] = perpFollowOffset(px, pz, w.followSide, 0.9);
          const [wx2, wz2] = resolveWalls(px, pz, w.parent.position.x, w.parent.position.z);
          if (wx2 !== px || wz2 !== pz) { px = w.parent.position.x; pz = w.parent.position.z; } // side spot is in a wall (doorway) — follow the parent directly
        }
        _charDir.set(px - holder.position.x, 0, pz - holder.position.z);
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
        if (dist < 0.25 || t > w.targetGiveUp) { // arrived — or stuck against a wall too long
          w.moving = false;
          w.pauseUntil = t + 0.6 + Math.random() * 1.8; // rest a moment
          pickRoamTarget(holder);
          // budget: travel time to the new target plus slack, so a wall-stuck
          // walker re-rolls within seconds instead of marching in place forever
          w.targetGiveUp = t + 5 + holder.position.distanceTo(w.target) / w.speed;
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
        holder.position.y = houseFloorHeight(rx, rz); // stand on stairs/lofts, not inside them
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
  updateOcclusionFade(dt); // after the camera settles: fade anything hiding the player
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
