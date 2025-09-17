# Prototype "Mini Figma" WebAssembly

Ce projet démontre une pile technique inspirée de Figma avec :

1. Un moteur C++ compilé en WebAssembly (Emscripten + Embind) qui maintient l’état vectoriel.
2. Un worker Web dédié qui charge le module Wasm, orchestre le rendu dans un `OffscreenCanvas` et communique via `postMessage`.
3. Une interface React qui gère les panneaux, les commandes et relaie les événements pointeur.

## Démarrer

```bash
npm install
npm run wasm    # optionnel tant que le moteur natif n’est pas compilé
npm run dev
```

Sans Wasm disponible, le worker retombe sur un moteur JavaScript de secours pour que l’UI reste interactive.

## Structure

- `engine/` — code C++ + configuration CMake/Emscripten.
- `public/engine/` — emplacement attendu de la sortie (`engine.mjs`, `engine.wasm`).
- `src/worker/` — worker qui fait tourner le Wasm hors du thread UI.
- `src/hooks/useEngine.ts` — pont React ←→ worker.
- `src/App.tsx` — workspace plein écran inspiré de TLDraw (pinceau libre + rectangles paramétrables).

## Points clés

- `OffscreenCanvas` est transféré au worker afin que le rendu s’effectue hors du thread principal.
- La communication est typée (`EngineCommand`, `PointerEventPayload`) pour faciliter l’extension.
- Le moteur C++ renvoie des données sérialisées (`tick()`) que le worker dessine côté JavaScript. Cela simplifie le prototypage avant d’implémenter un pipeline WebGL/WebGPU natif.
- L’UI propose un canevas plein écran avec palette flottante (couleurs/épaisseur) et barre d’outils inférieure. L’espace de travail scrolle librement grâce à une zone étendue avec marge de sécurité. Des contrôles de zoom (molette + raccourcis dans la barre) ajustent l’échelle du canvas sans distordre les coordonnées envoyées au worker. Le plan de travail s’étend automatiquement lorsque vous dessinez près des bords pour éviter toute limite invisible.
- L’outil pinceau fonctionne via des commandes `start/update/finishStroke`, ce qui prépare l’extension vers un vrai moteur natif.

## Aller plus loin

- Remplacer le fallback JS par le module Wasm compilé via `npm run wasm`.
- Implémenter un rendu GPU (WebGL/WebGPU) dans le moteur natif et passer par `SharedArrayBuffer` pour réduire la copie de données.
- Ajouter un protocole de commandes plus riche (sélection, transformation, multi-utilisateurs).
