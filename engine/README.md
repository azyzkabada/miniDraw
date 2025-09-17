# Moteur C++ → WebAssembly

Ce dossier contient une implémentation minimale du moteur natif compilé avec [Emscripten](https://emscripten.org/). Il valide l’architecture suivante :

1. C++ maintient l’état vectoriel (rectangles, présences).
2. La compilation génère `public/engine/engine.mjs` + `engine.wasm`.
3. Le worker JavaScript charge ce module et expose une API uniforme vers React.

## Prérequis

- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) initialisé dans votre shell (`emcmake`, `emcc`, … disponibles).
- CMake ≥ 3.20.

## Construction

```bash
npm run wasm
```

Ce script exécute :

```bash
emcmake cmake -S engine -B engine/build
cmake --build engine/build
```

La sortie est copiée dans `public/engine/` :

- `engine.mjs` → wrapper ES modules.
- `engine.wasm` → binaire WebAssembly.

## API exposée

Le module Emscripten exporte `createEngine(width, height)` qui retourne une instance `Engine` Embind côté JavaScript avec les méthodes :

- `resize(width, height)`
- `execute(command)` (objet `{ type: string, … }`)
- `pointerEvent(event)`
- `tick()` → `{ document, presences }`

Les commandes actuellement gérées côté moteur :

- `createRectangle`
- `startStroke` / `updateStroke` / `finishStroke`

Ces signatures correspondent à l’interface utilisée par `src/worker/engineWorker.ts`.
