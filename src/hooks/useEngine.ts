import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { EngineCommand, EngineStatePayload, PointerEventPayload } from '../engine/types';
import { EngineWorker, UIToWorkerMessage, WorkerToUIMessage } from '../engine/messages';

type CanvasRef = MutableRefObject<HTMLCanvasElement | null>;

type UseEngineResult = {
  state: EngineStatePayload;
  isReady: boolean;
  sendCommand: (command: EngineCommand) => void;
  forwardPointerEvent: (event: PointerEvent, scale?: { x: number; y: number }) => void;
};

const createWorker = () =>
  new Worker(new URL('../worker/engineWorker.ts', import.meta.url), {
    type: 'module'
  }) as EngineWorker;

const toPointerPayload = (
  event: PointerEvent,
  bounds: DOMRect,
  scale: { x: number; y: number }
): PointerEventPayload => ({
  type:
    event.type === 'pointerdown'
      ? 'pointerDown'
      : event.type === 'pointerup'
      ? 'pointerUp'
      : 'pointerMove',
  pointerId: event.pointerId,
  x: (event.clientX - bounds.left) * scale.x,
  y: (event.clientY - bounds.top) * scale.y,
  shiftKey: event.shiftKey,
  altKey: event.altKey,
  metaKey: event.metaKey
});

export const useEngine = (
  canvasRef: CanvasRef,
  logicalSize?: { width: number; height: number },
  zoom: number = 1
): UseEngineResult => {
  const workerRef = useRef<EngineWorker | null>(null);
  const initialSizeRef = useRef({ size: logicalSize, zoom });

  useEffect(() => {
    initialSizeRef.current = { size: logicalSize, zoom };
  }, [logicalSize?.height, logicalSize?.width, zoom]);
  const [state, setState] = useState<EngineStatePayload>({
    document: null,
    presences: []
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (!('transferControlToOffscreen' in canvas)) {
      console.warn('OffscreenCanvas non supporté par ce navigateur.');
      return;
    }

    const initial = initialSizeRef.current;
    if (initial?.size) {
      canvas.width = initial.size.width;
      canvas.height = initial.size.height;
    }

    const worker = createWorker();
    workerRef.current = worker;

    const offscreen = canvas.transferControlToOffscreen();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const handleMessage = (event: MessageEvent<WorkerToUIMessage>) => {
      const { data } = event;
      if (data.type === 'ready') {
        setIsReady(true);
        return;
      }

      if (data.type === 'state') {
        setState(data.payload);
        return;
      }

      if (data.type === 'log') {
        console.log('[engine]', data.message);
      }
    };

    worker.addEventListener('message', handleMessage);

    const initMessage: UIToWorkerMessage = {
      type: 'init',
      canvas: offscreen,
      devicePixelRatio: dpr
    };
    worker.postMessage(initMessage, [offscreen]);

    const sendResize = (width: number, height: number, scale: number) => {
      if (width === 0 || height === 0) {
        return;
      }
      worker.postMessage({ type: 'resize', width, height, zoom: scale });
    };

    const initialWidth = canvas.width;
    const initialHeight = canvas.height;
    sendResize(initialWidth, initialHeight, initial?.zoom ?? 1);

    return () => {
      worker.removeEventListener('message', handleMessage);
      worker.terminate();
      workerRef.current = null;
    };
  }, [canvasRef]);

  useEffect(() => {
    if (!logicalSize) {
      return;
    }
    const worker = workerRef.current;
    if (!worker) {
      return;
    }
    worker.postMessage({
      type: 'resize',
      width: logicalSize.width,
      height: logicalSize.height,
      zoom
    });
  }, [logicalSize?.height, logicalSize?.width, zoom]);

  const sendCommand = useCallback((command: EngineCommand) => {
    workerRef.current?.postMessage({ type: 'command', command });
  }, []);

  const forwardPointerEvent = useCallback(
    (event: PointerEvent, scale = { x: 1, y: 1 }) => {
      const canvas = canvasRef.current;
      if (!workerRef.current || !canvas) {
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      workerRef.current.postMessage({
        type: 'pointer',
        event: toPointerPayload(event, bounds, scale)
      });
    },
    [canvasRef]
  );

  return {
    state,
    isReady,
    sendCommand,
    forwardPointerEvent
  };
};
