import { memo, ReactNode } from 'react';

type TopBarProps = {
  totalStrokes: number;
  totalRectangles: number;
  onShare?: () => void;
  actionsSlot?: ReactNode;
};

export const TopBar = memo(({ totalStrokes, totalRectangles, onShare, actionsSlot }: TopBarProps) => {
  const hasShareAction = typeof onShare === 'function';

  return (
    <header className="top-bar">
      <div className="brand">
        <span className="brand-dot" />
        <span>MiniDraw</span>
      </div>
      <div className="top-actions">
        <span className="stats">{totalStrokes} traits · {totalRectangles} rectangles</span>
        {actionsSlot ?? (
          <button
            type="button"
            className="ghost"
            onClick={hasShareAction ? onShare : undefined}
            disabled={!hasShareAction}
          >
            Partager
          </button>
        )}
      </div>
    </header>
  );
});

TopBar.displayName = 'TopBar';
