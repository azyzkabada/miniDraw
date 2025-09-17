/// <reference lib="webworker" />

import {
  EngineCommand,
  EngineDocument,
  EngineStatePayload,
  EngineStroke,
  PointerEventPayload
} from '../engine/types';
import { UIToWorkerMessage, WorkerToUIMessage } from '../engine/messages';

interface EngineHandle {
  resize(width: number, height: number): void;
  pointerEvent(event: PointerEventPayload): void;
  execute(command: EngineCommand): void;
  tick(): EngineStatePayload;
}

interface EngineModule {
  createEngine(width: number, height: number): EngineHandle;
}

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let engine: EngineHandle | null = null;
let canvasCtx: OffscreenCanvasRenderingContext2D | null = null;
let devicePixelRatio = 1;
let renderScale = 1;
let isInitialized = false;
let animationHandle: number | null = null;

const FRAME_MS = 1000 / 60;

const post = (message: WorkerToUIMessage) => ctx.postMessage(message);

const paintState = (
  state: EngineStatePayload,
  context: OffscreenCanvasRenderingContext2D,
  scale: number
) => {
  if (!state.document) {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    return;
  }

  const logicalWidth = context.canvas.width / scale;
  const logicalHeight = context.canvas.height / scale;

  context.save();
  context.scale(scale, scale);
  context.clearRect(0, 0, logicalWidth, logicalHeight);
  for (const shape of state.document.shapes) {
    if (shape.kind === 'rectangle') {
      context.fillStyle = shape.color;
      context.fillRect(shape.x, shape.y, shape.width, shape.height);
      continue;
    }

    if (shape.kind === 'stroke') {
      const points = shape.points;
      context.strokeStyle = shape.color;
      context.lineWidth = shape.size;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      if (points.length === 1) {
        context.beginPath();
        context.arc(points[0].x, points[0].y, shape.size / 2, 0, Math.PI * 2);
        context.fillStyle = shape.color;
        context.fill();
        continue;
      }

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        const point = points[index];
        context.lineTo(point.x, point.y);
      }
      context.stroke();
    }
  }
  context.restore();
};

const renderLoop = () => {
  if (!engine || !canvasCtx) {
    return;
  }

  try {
    const state = engine.tick();
    paintState(state, canvasCtx, renderScale);
    post({ type: 'state', payload: state });
  } catch (error) {
    console.error(error);
    post({ type: 'log', message: `Erreur moteur: ${String(error)}` });
  }

  animationHandle = ctx.setTimeout(renderLoop, FRAME_MS);
};

const cancelLoop = () => {
  if (animationHandle !== null) {
    ctx.clearTimeout(animationHandle);
    animationHandle = null;
  }
};

const createMockEngine = (): EngineHandle => {
  const shapes: EngineDocument['shapes'] = [];
  const strokeIndex = new Map<string, number>();
  let rectangleCount = 0;
  let strokeCount = 0;
  const presences: EngineStatePayload['presences'] = [];

  const document: EngineDocument = {
    id: 'doc-1',
    name: 'Composition démo',
    shapes
  };

  const execute = (command: EngineCommand) => {
    switch (command.type) {
      case 'createRectangle': {
        rectangleCount += 1;
        const id = `rect-${rectangleCount}`;
        shapes.push({
          ...command,
          id,
          name: `Rectangle ${rectangleCount}`,
          kind: 'rectangle'
        });
        break;
      }
      case 'startStroke': {
        const stroke: EngineStroke = {
          id: command.id,
          name: `Trace ${++strokeCount}`,
          kind: 'stroke',
          color: command.color,
          size: command.size,
          points: [{ x: command.x, y: command.y }]
        };
        strokeIndex.set(command.id, shapes.length);
        shapes.push(stroke);
        break;
      }
      case 'updateStroke': {
        const index = strokeIndex.get(command.id);
        if (index !== undefined) {
          const shape = shapes[index];
          if (shape?.kind === 'stroke') {
            shape.points.push({ x: command.x, y: command.y });
          }
        }
        break;
      }
      case 'finishStroke':
        strokeIndex.delete(command.id);
        break;
      default:
        break;
    }
  };

  const pointerEvent = (event: PointerEventPayload) => {
    if (event.type !== 'pointerMove') {
      return;
    }

    const pointerIndex = presences.findIndex((presence) => presence.id === String(event.pointerId));
    const color = '#3b82f6';
    if (pointerIndex >= 0) {
      presences[pointerIndex] = {
        ...presences[pointerIndex],
        x: event.x,
        y: event.y
      };
    } else {
      presences.push({
        id: String(event.pointerId),
        color,
        x: event.x,
        y: event.y
      });
    }
  };

  return {
    resize: () => {},
    execute,
    pointerEvent,
    tick: () => ({
      document,
      presences
    })
  };
};

const loadEngineModule = async (): Promise<EngineModule | null> => {
  let moduleUrl: string | null = null;
  try {
    const response = await fetch('/engine/engine.mjs', {
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const source = await response.text();
    moduleUrl = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
    const module = await import(/* @vite-ignore */ moduleUrl);
    if (typeof module.default === 'function') {
      const instance = await module.default({
        locateFile: (path: string) => `/engine/${path}`
      });
      if ('createEngine' in instance) {
        return instance as unknown as EngineModule;
      }
    }
  } catch (error) {
    console.warn('Impossible de charger le module WebAssembly, fallback JS utilisé.', error);
  } finally {
    if (moduleUrl) {
      URL.revokeObjectURL(moduleUrl);
    }
  }
  return null;
};

const handleInit = async (message: Extract<UIToWorkerMessage, { type: 'init' }>) => {
  devicePixelRatio = message.devicePixelRatio;
  const module = await loadEngineModule();

  if (module) {
    engine = module.createEngine(0, 0);
    post({ type: 'log', message: 'Moteur Wasm initialisé.' });
  } else {
    engine = createMockEngine();
    post({ type: 'log', message: 'Moteur JS de secours initialisé.' });
  }

  canvasCtx = message.canvas.getContext('2d');
  if (!canvasCtx) {
    throw new Error('Impossible de récupérer le contexte 2D.');
  }

  isInitialized = true;
  post({ type: 'ready' });
  cancelLoop();
  renderLoop();
};

const handleResize = (message: Extract<UIToWorkerMessage, { type: 'resize' }>) => {
  if (!engine || !canvasCtx) {
    return;
  }

  const width = Math.max(1, Math.floor(message.width));
  const height = Math.max(1, Math.floor(message.height));

  renderScale = devicePixelRatio * Math.max(0.25, message.zoom);

  canvasCtx.canvas.width = Math.max(1, Math.floor(width * renderScale));
  canvasCtx.canvas.height = Math.max(1, Math.floor(height * renderScale));

  engine.resize(width, height);
};

const handleCommand = (message: Extract<UIToWorkerMessage, { type: 'command' }>) => {
  engine?.execute(message.command);
};

const handlePointer = (message: Extract<UIToWorkerMessage, { type: 'pointer' }>) => {
  engine?.pointerEvent(message.event);
};

ctx.addEventListener('message', (event: MessageEvent<UIToWorkerMessage>) => {
  const { data } = event;

  if (data.type === 'init') {
    handleInit(data).catch((error) => {
      console.error(error);
      post({ type: 'log', message: `Erreur d'init: ${String(error)}` });
    });
    return;
  }

  if (!isInitialized) {
    console.warn('Moteur non initialisé, message ignoré.');
    return;
  }

  switch (data.type) {
    case 'resize':
      handleResize(data);
      break;
    case 'command':
      handleCommand(data);
      break;
    case 'pointer':
      handlePointer(data);
      break;
    default:
      break;
  }
});
