import {
  ChangeEventHandler,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { StageCanvas } from './components/canvas/StageCanvas';
import { TopBar } from './components/layout/TopBar';
import { RightPanel } from './components/panel/RightPanel';
import { BottomToolbar } from './components/toolbar/BottomToolbar';
import type { EngineShape } from './engine/types';
import { useEngine } from './hooks/useEngine';
import type { Tool } from './types/tools';
import { computeCanvasMetrics } from './utils/dimensions';

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
  const [zoom, setZoom] = useState(1);
  const { state, isReady, sendCommand, forwardPointerEvent } = useEngine(canvasRef, workspaceSize, zoom);

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
  const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
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
        adjustScrollForZoom(next, current, focal);
        return next;
      });
    },
    [adjustScrollForZoom, clampZoom]
  );

  const getZoomFocal = useCallback(() => {
    if (lastPointerRef.current) {
      return lastPointerRef.current;
    }
    const scroll = scrollRef.current;
    if (!scroll) {
      return undefined;
    }
    const rect = scroll.getBoundingClientRect();
    return {
      clientX: rect.left + scroll.clientWidth / 2,
      clientY: rect.top + scroll.clientHeight / 2
    };
  }, []);

  const handleZoomIn = useCallback(() => {
    changeZoom(0.1, getZoomFocal());
  }, [changeZoom, getZoomFocal]);

  const handleZoomOut = useCallback(() => {
    changeZoom(-0.1, getZoomFocal());
  }, [changeZoom, getZoomFocal]);

  const handleZoomReset = useCallback(() => {
    applyZoom(1, getZoomFocal());
  }, [applyZoom, getZoomFocal]);

  const handleSelectTool = useCallback((tool: Tool) => {
    setActiveTool(tool);
  }, []);

  const handleSelectColor = useCallback((color: string) => {
    setActiveColor(color);
  }, []);

  const handleSelectBrushSize = useCallback((size: number) => {
    setBrushSettings({ size });
  }, []);

  const handleToggleRectangleCenter = useCallback<ChangeEventHandler<HTMLInputElement>>((event) => {
    const { checked } = event.target;
    setRectangleSettings((current) => ({
      ...current,
      centerOnPointer: checked
    }));
  }, []);

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

  const shapes = useMemo<EngineShape[]>(() => {
    const document = state.document;
    return document ? document.shapes : [];
  }, [state.document]);

  const canvasMetrics = useMemo(
    () => computeCanvasMetrics(workspaceSize, viewportSize, zoom),
    [workspaceSize.height, workspaceSize.width, viewportSize.height, viewportSize.width, zoom]
  );

  const handlePointerEvent = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isReady) {
        return;
      }

      lastPointerRef.current = { clientX: event.clientX, clientY: event.clientY };

      const canvas = event.currentTarget;
      const bounds = canvas.getBoundingClientRect();
      const { logicalWidth, logicalHeight } = canvasMetrics;
      const scaleX = logicalWidth > 0 ? workspaceSize.width / logicalWidth : 1;
      const scaleY = logicalHeight > 0 ? workspaceSize.height / logicalHeight : 1;
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
    [activeColor, activeTool, brushSettings.size, canvasMetrics, createRectangleAt, forwardPointerEvent, isReady, sendCommand, workspaceSize.height, workspaceSize.width]
  );

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
    const { logicalHeight, logicalWidth } = canvasMetrics;

    const grewWidth = workspaceSize.width > previous.width;
    const grewHeight = workspaceSize.height > previous.height;

    let targetLeft = scroll.scrollLeft;
    let targetTop = scroll.scrollTop;

    if (!didInitScrollRef.current || grewWidth || grewHeight) {
      targetLeft = Math.max(0, (logicalWidth + WORKSPACE_MARGIN * 2 - scroll.clientWidth) / 2);
      targetTop = Math.max(0, (logicalHeight + WORKSPACE_MARGIN * 2 - scroll.clientHeight) / 2);
    }

    const maxScrollLeft = Math.max(0, logicalWidth - scroll.clientWidth);
    const maxScrollTop = Math.max(0, logicalHeight - scroll.clientHeight);

    targetLeft = Math.min(targetLeft, maxScrollLeft);
    targetTop = Math.min(targetTop, maxScrollTop);

    if (targetLeft !== scroll.scrollLeft || targetTop !== scroll.scrollTop) {
      scroll.scrollTo({ left: targetLeft, top: targetTop, behavior: 'auto' });
    }

    didInitScrollRef.current = true;
    previousWorkspaceRef.current = workspaceSize;
  }, [canvasMetrics.logicalHeight, canvasMetrics.logicalWidth, workspaceSize.height, workspaceSize.width, zoom]);

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
        <StageCanvas
          canvasRef={canvasRef}
          metrics={canvasMetrics}
          zoom={zoom}
          onPointerEvent={handlePointerEvent}
        />
      </div>

      <TopBar totalStrokes={totalStrokes} totalRectangles={totalRectangles} />

      <RightPanel
        colors={colorPalette}
        activeColor={activeColor}
        onSelectColor={handleSelectColor}
        strokeSizes={strokeSizes}
        activeStrokeSize={brushSettings.size}
        onSelectStrokeSize={handleSelectBrushSize}
        centerRectangles={rectangleSettings.centerOnPointer}
        onToggleCenter={handleToggleRectangleCenter}
      />

      <BottomToolbar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        canDraw={isReady}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        statusMessage={isReady ? 'Dessinez librement sur la scène.' : 'Initialisation du moteur…'}
      />
    </div>
  );
};

export default App;
