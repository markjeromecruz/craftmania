# Craftmania

A small 2D Minecraft-style sandbox by **Sandy and Izaiah Adriano**, deployed as a static page via GitHub Pages.

## Features
- Side-view canvas world (100 × 50 blocks)
- Three playable characters: Steve, Sandy, WWE Champion
- Mining, building, and a 5-slot inventory (stone, wood, pickaxe, sword, food)
- **Five biomes** with their own terrain: plains, forest, desert, mountain, snow
- **Day / night cycle** (~6 min) — sun and stars in the sky; zombies spawn only at night and burn at dawn
- Pet wolves (P), vehicle mode (V), tool-aware mining speed
- Pure-function game logic in `src/*.js`, unit-tested with Vitest

## Play it
Open `index.html` (or visit the GitHub Pages URL). Controls are listed in-game once you start mining.

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) (for the test runner only — the game itself needs no build step)
- [Git](https://git-scm.com/)

### Setup
```bash
git clone https://github.com/markjeromecruz/craftmania.git
cd craftmania
npm install
npm test          # run the Vitest unit suite (pure-logic modules in src/)
```

### Repo layout
- `index.html` — single-page game (canvas + inline IIFE)
- `src/` — pure ES modules (biome, time, physics, mining, survival, render-data) loaded by `src/game-logic.global.js` into `window.CraftLogic`
- `tests/` — Vitest suites, one per `src/` module

## Contributing
We welcome contributions! Please follow these steps:
1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License
This project is open source and available under the [MIT License](LICENSE) (add LICENSE file if not present).

## Contact
For questions or suggestions, please open an issue in the repository.

---

*Happy crafting!* 