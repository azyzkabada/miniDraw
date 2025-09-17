export type Size = {
  width: number;
  height: number;
};

export type CanvasMetrics = {
  areaWidth: number;
  areaHeight: number;
  logicalWidth: number;
  logicalHeight: number;
};

export const computeCanvasMetrics = (
  workspaceSize: Size,
  viewportSize: Size,
  zoom: number
): CanvasMetrics => {
  const logicalWidth = Math.max(1, workspaceSize.width * zoom);
  const logicalHeight = Math.max(1, workspaceSize.height * zoom);
  const areaWidth = Math.max(logicalWidth, viewportSize.width);
  const areaHeight = Math.max(logicalHeight, viewportSize.height);

  return {
    areaWidth,
    areaHeight,
    logicalWidth,
    logicalHeight
  };
};
