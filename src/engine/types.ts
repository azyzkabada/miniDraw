export type EngineCommand =
  | {
      type: 'createRectangle';
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }
  | {
      type: 'startStroke';
      id: string;
      x: number;
      y: number;
      color: string;
      size: number;
    }
  | {
      type: 'updateStroke';
      id: string;
      x: number;
      y: number;
    }
  | {
      type: 'finishStroke';
      id: string;
    };

export interface EngineShapeBase {
  id: string;
  name: string;
}

export interface EngineRectangle extends EngineShapeBase {
  kind: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface EngineStrokePoint {
  x: number;
  y: number;
}

export interface EngineStroke extends EngineShapeBase {
  kind: 'stroke';
  color: string;
  size: number;
  points: EngineStrokePoint[];
}

export type EngineShape = EngineRectangle | EngineStroke;

export interface EngineDocument {
  id: string;
  name: string;
  shapes: EngineShape[];
}

export interface EnginePresence {
  id: string;
  color: string;
  x: number;
  y: number;
}

export interface EngineStatePayload {
  document: EngineDocument | null;
  presences: EnginePresence[];
}

export interface PointerEventPayload {
  type: 'pointerDown' | 'pointerMove' | 'pointerUp';
  pointerId: number;
  x: number;
  y: number;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}
