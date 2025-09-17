import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import type { EngineShape } from './engine/types';
import { useEngine } from './hooks/useEngine';

type Tool = 'select' | 'brush' | 'rectangle';

interface RectangleSettings {
  width: number;
  height: number;
  centerOnPointer: boolean;
}

interface BrushSettings {
  size: number;
}

const colorPalette = ['#0f172a', '#2563eb', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#14b8a6', '#64748b'];
const strokeSizes = [1, 2, 4, 8, 12, 18, 24, 30, 36, 44];

const INITIAL_WORKSPACE_WIDTH = 1920;
const INITIAL_WORKSPACE_HEIGHT = 1080;
const EXTEND_STEP = 640;
const EDGE_THRESHOLD = 160;
const WORKSPACE_MARGIN = 0;

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [workspaceSize, setWorkspaceSize] = useState({
    width: INITIAL_WORKSPACE_WIDTH,
    height: INITIAL_WORKSPACE_HEIGHT
  });
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : INITIAL_WORKSPACE_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight : INITIAL_WORKSPACE_HEIGHT
  }));
  const { state, isReady, sendCommand, forwardPointerEvent } = useEngine(canvasRef, workspaceSize);

  const [activeTool, setActiveTool] = useState<Tool>('brush');
  const [activeColor, setActiveColor] = useState<string>(colorPalette[1]);
  const [rectangleSettings, setRectangleSettings] = useState<RectangleSettings>({
    width: 240,
    height: 160,
    centerOnPointer: true
  });
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: strokeSizes[3]
  });
  const brushStrokeMapRef = useRef<Map<number, string>>(new Map());
  const [zoom, setZoom] = useState(1);
  const previousWorkspaceRef = useRef(workspaceSize);
  const didInitScrollRef = useRef(false);

  const clampZoom = useCallback((value: number) => {
    const minZoom = 0.25;
    const maxZoom = 4;
    const next = Math.min(maxZoom, Math.max(minZoom, value));
    return Number(next.toFixed(2));
  }, []);

  const adjustScrollForZoom = useCallback(
    (nextZoom: number, currentZoom: number, focal?: { clientX: number; clientY: number }) => {
      const scroll = scrollRef.current;
      if (!scroll || currentZoom === 0) {
        return;
      }

      const rect = scroll.getBoundingClientRect();
      const focusX = focal?.clientX ?? rect.left + scroll.clientWidth / 2;
      const focusY = focal?.clientY ?? rect.top + scroll.clientHeight / 2;
      const offsetX = focusX - rect.left;
      const offsetY = focusY - rect.top;

      const workspaceFocusX = (scroll.scrollLeft + offsetX) / currentZoom;
      const workspaceFocusY = (scroll.scrollTop + offsetY) / currentZoom;

      const scaledWidth = workspaceSize.width * nextZoom;
      const scaledHeight = workspaceSize.height * nextZoom;

      const maxScrollLeft = Math.max(0, scaledWidth - scroll.clientWidth);
      const maxScrollTop = Math.max(0, scaledHeight - scroll.clientHeight);

      const targetLeft = Math.min(
        maxScrollLeft,
        Math.max(0, workspaceFocusX * nextZoom - offsetX)
      );
      const targetTop = Math.min(
        maxScrollTop,
        Math.max(0, workspaceFocusY * nextZoom - offsetY)
      );

      scroll.scrollTo({ left: targetLeft, top: targetTop, behavior: 'auto' });
    },
    [workspaceSize.height, workspaceSize.width]
  );

  const applyZoom = useCallback(
    (value: number, focal?: { clientX: number; clientY: number }) => {
      setZoom((current) => {
        const next = clampZoom(value);
        if (next === current) {
          return current;
        }
        adjustScrollForZoom(next, current, focal);
        return next;
      });
    },
    [adjustScrollForZoom, clampZoom]
  );

  const changeZoom = useCallback(
    (delta: number, focal?: { clientX: number; clientY: number }) => {
      setZoom((current) => {
        const next = clampZoom(current + delta);
        if (next === current) {
          return current;
        }
        adjustScrollForZoom(next, current, focal);
        return next;
      });
    },
    [adjustScrollForZoom, clampZoom]
  );

  const setColor = (color: string) => {
    setActiveColor(color);
  };

  const setBrushSize = (size: number) => {
    setBrushSettings({ size });
  };

  const toggleRectangleCenter = () => {
    setRectangleSettings((current) => ({
      ...current,
      centerOnPointer: !current.centerOnPointer
    }));
  };

  const createRectangleAt = useCallback(
    (x: number, y: number) => {
      const { width, height, centerOnPointer } = rectangleSettings;
      const offsetX = centerOnPointer ? width / 2 : 0;
      const offsetY = centerOnPointer ? height / 2 : 0;
      sendCommand({
        type: 'createRectangle',
        x: Math.max(0, x - offsetX),
        y: Math.max(0, y - offsetY),
        width,
        height,
        color: activeColor
      });
    },
    [activeColor, rectangleSettings, sendCommand]
  );

  const handlePointerEvent = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isReady) {
        return;
      }

      const canvas = event.currentTarget;
      const bounds = canvas.getBoundingClientRect();
      const scaleX = bounds.width > 0 ? workspaceSize.width / bounds.width : 1;
      const scaleY = bounds.height > 0 ? workspaceSize.height / bounds.height : 1;
      const localX = (event.clientX - bounds.left) * scaleX;
      const localY = (event.clientY - bounds.top) * scaleY;

      if (event.type === 'pointerdown') {
        canvas.setPointerCapture(event.pointerId);

        if (activeTool === 'rectangle') {
          createRectangleAt(localX, localY);
        }

        if (activeTool === 'brush') {
          const strokeId = `stroke-${Date.now()}-${event.pointerId}`;
          brushStrokeMapRef.current.set(event.pointerId, strokeId);
          sendCommand({
            type: 'startStroke',
            id: strokeId,
            x: localX,
            y: localY,
            color: activeColor,
            size: brushSettings.size
          });
        }
      }

      if (event.type === 'pointermove') {
        const strokeId = brushStrokeMapRef.current.get(event.pointerId);
        if (strokeId) {
          const hasCapture =
            typeof canvas.hasPointerCapture === 'function' &&
            canvas.hasPointerCapture(event.pointerId);
          const isDrawing = event.buttons !== 0 || hasCapture;

          if (isDrawing) {
            sendCommand({ type: 'updateStroke', id: strokeId, x: localX, y: localY });
          } else {
            if (hasCapture) {
              canvas.releasePointerCapture(event.pointerId);
            }
            sendCommand({ type: 'finishStroke', id: strokeId });
            brushStrokeMapRef.current.delete(event.pointerId);
          }
        }
      }

      if (event.type === 'pointerup' || event.type === 'pointercancel') {
        if (typeof canvas.hasPointerCapture === 'function' && canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
        const strokeId = brushStrokeMapRef.current.get(event.pointerId);
        if (strokeId) {
          sendCommand({ type: 'finishStroke', id: strokeId });
          brushStrokeMapRef.current.delete(event.pointerId);
        }
      }

      event.preventDefault();
      forwardPointerEvent(event.nativeEvent, { x: scaleX, y: scaleY });
    },
    [activeColor, activeTool, brushSettings.size, createRectangleAt, forwardPointerEvent, isReady, sendCommand, workspaceSize.height, workspaceSize.width]
  );

  const shapes = useMemo<EngineShape[]>(() => {
    const document = state.document;
    return document ? document.shapes : [];
  }, [state.document]);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateWorkspaceFromShapes = useCallback(
    (currentSize: { width: number; height: number }) => {
      let maxX = 0;
      let maxY = 0;

      for (const shape of shapes) {
        if (shape.kind === 'rectangle') {
          maxX = Math.max(maxX, shape.x + shape.width);
          maxY = Math.max(maxY, shape.y + shape.height);
        } else if (shape.kind === 'stroke') {
          for (const point of shape.points) {
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
          }
        }
      }

      const desiredWidthBase = shapes.length === 0 ? INITIAL_WORKSPACE_WIDTH : maxX + EDGE_THRESHOLD;
      const desiredHeightBase = shapes.length === 0 ? INITIAL_WORKSPACE_HEIGHT : maxY + EDGE_THRESHOLD;

      const desiredWidth = Math.max(desiredWidthBase, viewportSize.width / zoom, INITIAL_WORKSPACE_WIDTH);
      const desiredHeight = Math.max(desiredHeightBase, viewportSize.height / zoom, INITIAL_WORKSPACE_HEIGHT);

      const nextWidth = Math.max(
        INITIAL_WORKSPACE_WIDTH,
        Math.ceil(desiredWidth / EXTEND_STEP) * EXTEND_STEP
      );
      const nextHeight = Math.max(
        INITIAL_WORKSPACE_HEIGHT,
        Math.ceil(desiredHeight / EXTEND_STEP) * EXTEND_STEP
      );

      if (nextWidth === currentSize.width && nextHeight === currentSize.height) {
        return currentSize;
      }

      return {
        width: nextWidth,
        height: nextHeight
      };
    },
    [shapes, viewportSize.height, viewportSize.width, zoom]
  );

  useEffect(() => {
    setWorkspaceSize((current) => updateWorkspaceFromShapes(current));
  }, [updateWorkspaceFromShapes]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) {
      previousWorkspaceRef.current = workspaceSize;
      return;
    }

    const previous = previousWorkspaceRef.current;
    const scaledWidth = workspaceSize.width * zoom;
    const scaledHeight = workspaceSize.height * zoom;

    const grewWidth = workspaceSize.width > previous.width;
    const grewHeight = workspaceSize.height > previous.height;

    let targetLeft = scroll.scrollLeft;
    let targetTop = scroll.scrollTop;

    if (!didInitScrollRef.current || grewWidth || grewHeight) {
      targetLeft = Math.max(0, (scaledWidth + WORKSPACE_MARGIN * 2 - scroll.clientWidth) / 2);
      targetTop = Math.max(0, (scaledHeight + WORKSPACE_MARGIN * 2 - scroll.clientHeight) / 2);
    }

    const maxScrollLeft = Math.max(0, scaledWidth - scroll.clientWidth);
    const maxScrollTop = Math.max(0, scaledHeight - scroll.clientHeight);

    targetLeft = Math.min(targetLeft, maxScrollLeft);
    targetTop = Math.min(targetTop, maxScrollTop);

    if (targetLeft !== scroll.scrollLeft || targetTop !== scroll.scrollTop) {
      scroll.scrollTo({ left: targetLeft, top: targetTop, behavior: 'auto' });
    }

    didInitScrollRef.current = true;
    previousWorkspaceRef.current = workspaceSize;
  }, [workspaceSize.height, workspaceSize.width, zoom]);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      const step = 0.1;
      const direction = event.deltaY > 0 ? -step : step;
      changeZoom(direction, { clientX: event.clientX, clientY: event.clientY });
    },
    [changeZoom]
  );

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) {
      return;
    }

    const listener = (event: WheelEvent) => handleWheel(event);
    scroll.addEventListener('wheel', listener, { passive: false });
    return () => {
      scroll.removeEventListener('wheel', listener);
    };
  }, [handleWheel]);

  const totalStrokes = shapes.filter((shape) => shape.kind === 'stroke').length;
  const totalRectangles = shapes.filter((shape) => shape.kind === 'rectangle').length;

  return (
    <div className="stage">
      <div className="canvas-scroll" ref={scrollRef}>
        <div
          className="canvas-area"
          style={{
            width: Math.max(workspaceSize.width * zoom, viewportSize.width),
            height: Math.max(workspaceSize.height * zoom, viewportSize.height)
          }}
        >
          <div
            className="canvas-inner"
            style={{
              width: workspaceSize.width,
              height: workspaceSize.height,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left'
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: workspaceSize.width,
                height: workspaceSize.height
              }}
              onPointerDown={handlePointerEvent}
              onPointerMove={handlePointerEvent}
              onPointerUp={handlePointerEvent}
              onPointerCancel={handlePointerEvent}
            />
          </div>
        </div>
      </div>

      <header className="top-bar">
        <div className="brand">
          <span className="brand-dot" />
          <span>MiniDraw</span>
        </div>
        <div className="top-actions">
          <span className="stats">{totalStrokes} traits · {totalRectangles} rectangles</span>
          <button type="button" className="ghost">Partager</button>
        </div>
      </header>

      <div className="top-right panel">
          <div className="panel-section">
            <span className="panel-title">Couleur</span>
            <div className="color-grid">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch${color === activeColor ? ' active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setColor(color)}
                />
              ))}
            </div>
          </div>

          <div className="panel-section">
            <span className="panel-title">Épaisseur</span>
            <div className="size-row">
              {strokeSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`size-pill${size === brushSettings.size ? ' active' : ''}`}
                  onClick={() => setBrushSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={rectangleSettings.centerOnPointer}
                onChange={toggleRectangleCenter}
              />
              Centrer les rectangles
            </label>
          </div>
        </div>

        <div className="bottom-toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              className={activeTool === 'select' ? 'active' : ''}
              onClick={() => setActiveTool('select')}
            >
              ⬚
            </button>
            <button
              type="button"
              className={activeTool === 'brush' ? 'active' : ''}
              onClick={() => setActiveTool('brush')}
              disabled={!isReady}
            >
              ✒️
            </button>
            <button
              type="button"
              className={activeTool === 'rectangle' ? 'active' : ''}
              onClick={() => setActiveTool('rectangle')}
              disabled={!isReady}
            >
              ▭
            </button>
          </div>
          <div className="toolbar-group zoom-controls">
            <button type="button" onClick={() => changeZoom(0.1)}>+</button>
            <span className="hint">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => changeZoom(-0.1)}>-</button>
            <button type="button" onClick={() => applyZoom(1)}>Reset</button>
          </div>
          <div className="toolbar-group">
            <span className="hint">{isReady ? 'Dessinez librement sur la scène.' : 'Initialisation du moteur…'}</span>
          </div>
        </div>
    </div>
  );
};

export default App;
