declare module '/engine/engine.mjs' {
  import { EngineCommand, EngineStatePayload, PointerEventPayload } from '../engine/types';

  export interface EngineHandle {
    resize(width: number, height: number): void;
    pointerEvent(event: PointerEventPayload): void;
    execute(command: EngineCommand): void;
    tick(): EngineStatePayload;
  }

  export interface EngineModule {
    createEngine(width: number, height: number): EngineHandle;
  }

  export interface EngineInitOptions {
    locateFile?: (path: string) => string;
  }

  const init: (options?: EngineInitOptions) => Promise<EngineModule>;
  export default init;
}
