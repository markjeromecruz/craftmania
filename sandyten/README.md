# Sandyten — 3D world

A 3D game built with **three.js** and **anime.js**, served as a static page on a
subpath of the Craftmania repo. **No build step, no internet required** — every
library is vendored locally and loaded through an importmap.

> This is a *starter canvas*. The kids describe what they want; we build it here.

## Play it locally
```bash
# from the repo root
python3 -m http.server 8765
# then open http://127.0.0.1:8765/sandyten/
```
(Module scripts + importmaps need `http://`, not `file://`.)

## Layout
```
sandyten/
├── index.html          # importmap + loading screen + HUD
├── src/
│   └── main.js         # the scene (renderer, sky, lights, post-fx, controls, intro)
├── assets/             # drop downloaded models / textures / audio here
└── vendor/             # local copies of the libraries (committed)
    ├── three/
    │   ├── three.module.js        # three.js r185 core
    │   └── addons/                # the FULL three.js examples/jsm — every addon is ready
    └── anime/
        └── anime.esm.js           # anime.js v4.5.0 (full ESM bundle)
```

## Using the libraries
The importmap in `index.html` wires up bare specifiers, so code reads exactly
like the official docs:

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';   // load 3D models
import { animate, createTimeline, stagger, utils } from 'animejs';
```

Anything under `node_modules/three/examples/jsm/` is available under
`three/addons/…` — controls, loaders (GLTF/FBX/OBJ/Draco), postprocessing
(bloom, SSAO, outline), Sky, Water, lil-gui, noise, and more.

## Free assets
When a theme is described, we pull **free, license-clean** assets from the web and
drop them in `assets/`. Good sources:
- **Models:** [Poly Pizza](https://poly.pizza), [Quaternius](https://quaternius.com),
  [Kenney](https://kenney.nl) (CC0)
- **Textures:** [Poly Haven](https://polyhaven.com), [ambientCG](https://ambientcg.com) (CC0)
- **Audio:** [Freesound](https://freesound.org), [Kenney audio](https://kenney.nl) (CC0)

GLB/GLTF models load with `GLTFLoader`; HDR environments with `RGBELoader`.

## What's already wired up
Renderer (ACES tone mapping, shadows), a real **Sky** with a movable sun,
hemisphere + directional lighting, a ground plane, **bloom** post-processing,
**OrbitControls**, an animated **loading screen → HUD** reveal, and a 60fps
render loop with an FPS readout. Replace the placeholder floating crystals in
`src/main.js` with the real game.
