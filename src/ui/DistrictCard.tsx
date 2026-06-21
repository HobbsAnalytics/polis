import type { DistrictVM } from '../engine/types.ts';
import { conditionLabel } from '../engine/viewModel.ts';
import { labelSlug } from './labels.ts';

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function DistrictCard({ district }: { district: DistrictVM }) {
  const healthLabel = conditionLabel(district.health);
  const slug = labelSlug(healthLabel);
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="district-head">
        <h3 className="district-name">{district.name}</h3>
        <span className={`badge tcond-${slug}`}>{healthLabel}</span>
      </div>
      <p className="muted">{district.description}</p>

      <div className="bar">
        <div className={`bar-fill cond-${slug}`} style={{ width: pct(district.health) }} />
      </div>

      <div className="section-label">Neighborhood ({district.generic.length} buildings)</div>
      <div className="chips">
        {district.generic.length === 0 ? (
          <span className="abandoned">abandoned</span>
        ) : (
          district.generic.map((b, i) => (
            <span key={i} className={`chip cond-${labelSlug(b.label)}`} title={b.label} />
          ))
        )}
      </div>

      {district.landmarks.length > 0 && (
        <>
          <div className="section-label">Landmarks</div>
          {district.landmarks.map((lm) => {
            const lmSlug = labelSlug(lm.label);
            return (
              <div key={lm.id} className="landmark">
                <div className="landmark-head">
                  <span className="landmark-name">
                    {lm.name} <span className="tier">tier {lm.tier}</span>
                  </span>
                  <span className={`badge tcond-${lmSlug}`}>{lm.label}</span>
                </div>
                <div className="bar bar-lg">
                  <div className={`bar-fill cond-${lmSlug}`} style={{ width: pct(lm.condition) }} />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
