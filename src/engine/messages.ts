import { EngineCommand, EngineStatePayload, PointerEventPayload } from './types';

export type UIToWorkerMessage =
  | { type: 'init'; canvas: OffscreenCanvas; devicePixelRatio: number }
  | { type: 'resize'; width: number; height: number; zoom: number }
  | { type: 'command'; command: EngineCommand }
  | { type: 'pointer'; event: PointerEventPayload };

export type WorkerToUIMessage =
  | { type: 'ready' }
  | { type: 'state'; payload: EngineStatePayload }
  | { type: 'log'; message: string };

export type EngineWorker = Worker & {
  postMessage(message: UIToWorkerMessage, transfer?: Transferable[]): void;
};
