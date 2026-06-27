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
const billboards = []; // meshes that turn to face the camera each frame

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
  })
  .catch((err) => console.warn('Could not load characters.json', err));

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

  // Characters: wander around, face the camera (upright billboard), and bob/hop.
  for (const b of billboards) {
    const holder = b.parent;
    const w = holder.userData;

    // roam toward the current target, then pause and pick a new one
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

  updateMovement(dt);
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
