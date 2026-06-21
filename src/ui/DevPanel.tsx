// =============================================================================
// TEMPORARY DEV TOOL — not part of the final product.
// Lets you fast-forward simulated days to watch how growth/decay scale over
// weeks and months. Delete this file and its usage in App.tsx before release.
// =============================================================================

export type AdvanceMode = 'good' | 'neglect' | 'bad';

interface Props {
  onAdvance: (times: number, mode: AdvanceMode) => void;
  onReset: () => void;
}

const STEPS = [1, 7, 30];

const ROWS: { mode: AdvanceMode; label: string; hint: string }[] = [
  { mode: 'good', label: 'All good habits', hint: 'every good habit done each day' },
  { mode: 'neglect', label: 'Neglect', hint: 'no check-in (entropy only)' },
  { mode: 'bad', label: 'All bad habits', hint: 'every bad habit logged each day' },
];

export function DevPanel({ onAdvance, onReset }: Props) {
  return (
    <div className="panel dev-panel">
      <div className="dev-head">
        <h2>🛠 Time-travel (dev only)</h2>
        <button className="btn" onClick={onReset}>
          Reset to seed
        </button>
      </div>
      <p className="muted">Temporary tool to fast-forward simulated days. Not in the final product.</p>

      <div className="dev-rows">
        {ROWS.map((row) => (
          <div key={row.mode} className="dev-row">
            <div className="dev-row-label">
              <span className="landmark-name">{row.label}</span>
              <span className="tier"> {row.hint}</span>
            </div>
            <div className="dev-buttons">
              {STEPS.map((n) => (
                <button key={n} className="btn" onClick={() => onAdvance(n, row.mode)}>
                  +{n}d
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
