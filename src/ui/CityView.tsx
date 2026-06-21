import type { CityViewModel } from '../engine/types.ts';
import { DistrictCard } from './DistrictCard.tsx';

export function CityView({ vm }: { vm: CityViewModel }) {
  return (
    <div className="city-grid">
      {vm.districts.map((d) => (
        <DistrictCard key={d.id} district={d} />
      ))}
    </div>
  );
}
