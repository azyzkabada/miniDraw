import { memo, PointerEvent as ReactPointerEvent, RefObject } from 'react';

import type { CanvasMetrics } from '../../utils/dimensions';

type StageCanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement>;
  metrics: CanvasMetrics;
  zoom: number;
  onPointerEvent: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
};

export const StageCanvas = memo(
  ({ canvasRef, metrics, zoom, onPointerEvent }: StageCanvasProps) => (
    <div
      className="canvas-area"
      style={{
        width: metrics.areaWidth,
        height: metrics.areaHeight
      }}
      data-zoom={zoom}
    >
      <div
        className="canvas-inner"
        style={{
          width: metrics.logicalWidth,
          height: metrics.logicalHeight
        }}
        data-zoom={zoom}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: metrics.logicalWidth,
            height: metrics.logicalHeight
          }}
          data-zoom={zoom}
          onPointerDown={onPointerEvent}
          onPointerMove={onPointerEvent}
          onPointerUp={onPointerEvent}
          onPointerCancel={onPointerEvent}
        />
      </div>
    </div>
  )
);

StageCanvas.displayName = 'StageCanvas';
