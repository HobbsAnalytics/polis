import type { BoroughVM, DistrictVM, LandmarkVM } from '../engine/types.ts';
import { conditionSlug } from '../engine/viewModel.ts';

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function LandmarkRow({ lm }: { lm: LandmarkVM }) {
  const slug = conditionSlug(lm.label);
  return (
    <div className="landmark">
      <div className="landmark-head">
        <span className="landmark-name">
          {lm.name} <span className="tier">tier {lm.tier}</span>
        </span>
        <span className={`badge tcond-${slug}`}>{lm.label}</span>
      </div>
      <div className="bar bar-lg">
        <div className={`bar-fill cond-${slug}`} style={{ width: pct(lm.condition) }} />
      </div>
    </div>
  );
}

function BoroughBlock({ borough }: { borough: BoroughVM }) {
  const slug = conditionSlug(borough.label);
  return (
    <div className="borough">
      <div className="landmark-head">
        <span className="landmark-name">⌂ {borough.name}</span>
        <span className={`badge tcond-${slug}`}>{borough.label}</span>
      </div>
      <div className="bar bar-lg">
        <div className={`bar-fill cond-${slug}`} style={{ width: pct(borough.health) }} />
      </div>
      {borough.generic.length > 0 && (
        <div className="chips">
          {borough.generic.map((b) => (
            <span key={b.id} className={`chip cond-${conditionSlug(b.label)}`} title={b.label} />
          ))}
        </div>
      )}
      {borough.landmarks.map((lm) => (
        <LandmarkRow key={lm.id} lm={lm} />
      ))}
    </div>
  );
}

export function DistrictCard({ district }: { district: DistrictVM }) {
  const slug = conditionSlug(district.label);
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="district-head">
        <h3 className="district-name">{district.name}</h3>
        <span className={`badge tcond-${slug}`}>{district.label}</span>
      </div>
      <p className="muted">{district.description}</p>

      <div className="bar">
        <div className={`bar-fill cond-${slug}`} style={{ width: pct(district.health) }} />
      </div>

      {district.maturity > 0 && (
        <div className="maturity">maturity {district.maturity.toFixed(1)}</div>
      )}

      {district.features.length > 0 && (
        <div className="features">
          {district.features.map((f) => (
            <span key={f.id} className="feature" title={f.name}>
              {f.emoji} {f.name}
            </span>
          ))}
        </div>
      )}

      <div className="section-label">Neighborhood ({district.generic.length} buildings)</div>
      <div className="chips">
        {district.generic.length === 0 ? (
          <span className="abandoned">empty lot</span>
        ) : (
          district.generic.map((b) => (
            <span key={b.id} className={`chip cond-${conditionSlug(b.label)}`} title={b.label} />
          ))
        )}
      </div>

      {district.boroughs.length > 0 && (
        <>
          <div className="section-label">Boroughs</div>
          {district.boroughs.map((b) => (
            <BoroughBlock key={b.id} borough={b} />
          ))}
        </>
      )}

      {district.landmarks.length > 0 && (
        <>
          <div className="section-label">Landmarks</div>
          {district.landmarks.map((lm) => (
            <LandmarkRow key={lm.id} lm={lm} />
          ))}
        </>
      )}
    </div>
  );
}
