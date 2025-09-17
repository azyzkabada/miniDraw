import { memo, useCallback, useEffect, useRef } from 'react';

import type { Tool } from '../../types/tools';

type BottomToolbarProps = {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  canDraw: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  statusMessage: string;
};

export const BottomToolbar = memo(
  ({
    activeTool,
    onSelectTool,
    canDraw,
    zoom,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    statusMessage
  }: BottomToolbarProps) => {
    const HOLD_DELAY_MS = 220;
    const repeatTimerRef = useRef<number | null>(null);
    const holdTimeoutRef = useRef<number | null>(null);
    const holdTriggeredRef = useRef(false);
    const skipNextClickRef = useRef(false);

    const clearTimers = useCallback(() => {
      if (holdTimeoutRef.current !== null) {
        window.clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
      if (repeatTimerRef.current !== null) {
        window.clearInterval(repeatTimerRef.current);
        repeatTimerRef.current = null;
      }
    }, []);

    const startRepeat = useCallback(
      (action: () => void) => {
        if (typeof window === 'undefined') {
          return;
        }
        clearTimers();
        holdTriggeredRef.current = false;
        skipNextClickRef.current = false;
        holdTimeoutRef.current = window.setTimeout(() => {
          holdTriggeredRef.current = true;
          skipNextClickRef.current = true;
          action();
          repeatTimerRef.current = window.setInterval(action, 120);
        }, HOLD_DELAY_MS);
      },
      [clearTimers]
    );

    const finishRepeat = useCallback(
      (preserveSkip: boolean) => {
        const triggered = holdTriggeredRef.current;
        clearTimers();
        holdTriggeredRef.current = false;
        if (!triggered || !preserveSkip) {
          skipNextClickRef.current = false;
        }
      },
      [clearTimers]
    );

    useEffect(() => {
      if (typeof window === 'undefined') {
        return undefined;
      }

      const cancel = () => finishRepeat(false);

      window.addEventListener('mouseup', cancel);
      window.addEventListener('touchend', cancel);
      window.addEventListener('touchcancel', cancel);

      return () => {
        window.removeEventListener('mouseup', cancel);
        window.removeEventListener('touchend', cancel);
        window.removeEventListener('touchcancel', cancel);
        finishRepeat(false);
      };
    }, [finishRepeat]);

    const handleZoomHold = useCallback(
      (action: () => void) => ({
        onMouseDown: () => startRepeat(action),
        onTouchStart: () => startRepeat(action),
        onMouseUp: () => finishRepeat(true),
        onMouseLeave: () => finishRepeat(false),
        onTouchEnd: () => finishRepeat(true),
        onTouchCancel: () => finishRepeat(false)
      }),
      [finishRepeat, startRepeat]
    );

    const handleZoomClick = useCallback(
      (action: () => void) => () => {
        if (skipNextClickRef.current) {
          skipNextClickRef.current = false;
          return;
        }
        action();
      },
      []
    );

    const zoomInHoldHandlers = handleZoomHold(onZoomIn);
    const zoomOutHoldHandlers = handleZoomHold(onZoomOut);
    const zoomInClick = handleZoomClick(onZoomIn);
    const zoomOutClick = handleZoomClick(onZoomOut);

    return (
      <div className="bottom-toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            className={activeTool === 'select' ? 'active' : ''}
            onClick={() => onSelectTool('select')}
          >
            ⬚
          </button>
          <button
            type="button"
            className={activeTool === 'brush' ? 'active' : ''}
            onClick={() => onSelectTool('brush')}
            disabled={!canDraw}
          >
            ✒️
          </button>
          <button
            type="button"
            className={activeTool === 'rectangle' ? 'active' : ''}
            onClick={() => onSelectTool('rectangle')}
            disabled={!canDraw}
          >
            ▭
          </button>
        </div>
        <div className="toolbar-group zoom-controls">
          <button type="button" onClick={zoomInClick} {...zoomInHoldHandlers}>
            +
          </button>
          <span className="hint">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={zoomOutClick} {...zoomOutHoldHandlers}>
            -
          </button>
          <button type="button" onClick={onZoomReset}>
            Reset
          </button>
        </div>
        <div className="toolbar-group">
          <span className="hint">{statusMessage}</span>
        </div>
      </div>
    );
  }
);

BottomToolbar.displayName = 'BottomToolbar';
