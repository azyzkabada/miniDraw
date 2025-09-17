import { ChangeEventHandler, memo } from 'react';

type RightPanelProps = {
  colors: string[];
  activeColor: string;
  onSelectColor: (color: string) => void;
  strokeSizes: number[];
  activeStrokeSize: number;
  onSelectStrokeSize: (size: number) => void;
  centerRectangles: boolean;
  onToggleCenter: ChangeEventHandler<HTMLInputElement>;
};

export const RightPanel = memo(
  ({
    colors,
    activeColor,
    onSelectColor,
    strokeSizes,
    activeStrokeSize,
    onSelectStrokeSize,
    centerRectangles,
    onToggleCenter
  }: RightPanelProps) => (
    <div className="top-right panel">
      <div className="panel-section">
        <span className="panel-title">Couleur</span>
        <div className="color-grid">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-swatch${color === activeColor ? ' active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onSelectColor(color)}
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
              className={`size-pill${size === activeStrokeSize ? ' active' : ''}`}
              onClick={() => onSelectStrokeSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <label className="checkbox">
          <input type="checkbox" checked={centerRectangles} onChange={onToggleCenter} />
          Centrer les rectangles
        </label>
      </div>
    </div>
  )
);

RightPanel.displayName = 'RightPanel';
