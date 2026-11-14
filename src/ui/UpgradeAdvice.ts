/** Advice is based on current work, never just on an affordable price. */
export interface UpgradePressure {
  id: string; kind: string; upgradeableSpeed: boolean; upgradeableCap: boolean;
  stock: number; capacity: number; demand: number; queue: number;
  seats: number; usedSeats: number;
}
export interface UpgradeChoice { id: string; kind: 'speed' | 'cap'; reason: 'queue' | 'production' | 'seating' }
export function chooseUpgradePressure(stations: readonly UpgradePressure[]): UpgradeChoice | null {
  const queue = stations.filter(s=>s.kind==='counter'&&s.upgradeableSpeed&&s.queue>=2).sort((a,b)=>b.queue-a.queue)[0];
  if(queue)return {id:queue.id,kind:'speed',reason:'queue'};
  const production = stations.filter(s=>s.kind==='machine'&&s.upgradeableSpeed&&s.stock===0&&s.demand>0)
    .sort((a,b)=>b.demand-a.demand)[0];
  if(production)return {id:production.id,kind:'speed',reason:'production'};
  const tables=stations.filter(s=>s.kind==='table'), seats=tables.reduce((n,s)=>n+s.seats,0), used=tables.reduce((n,s)=>n+s.usedSeats,0);
  if(seats>0&&used/seats>=0.85) {
    const empty=tables.find(s=>s.upgradeableCap&&s.usedSeats===0);
    if(empty)return {id:empty.id,kind:'cap',reason:'seating'};
  }
  return null;
}

/** Pick the highest relative gain-per-coin candidate among unlocked upgrade options. */
export function pickBestRoiId(candidates: readonly { id: string; cost: number; weight: number }[]): string | null {
  let bestId: string | null = null;
  let bestScore = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!(c.cost > 0) || !(c.weight > 0)) continue;
    const score = c.weight / c.cost;
    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
  }
  return bestId;
}
