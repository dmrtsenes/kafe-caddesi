/** Validate persisted shapes before a damaged slot reaches the simulation.
 * Optional fields stay optional so additions within save v8 remain compatible. */
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const stringList = (value: unknown): boolean => Array.isArray(value) && value.every(item => typeof item === 'string');
const numberMap = (value: unknown): boolean => record(value) && Object.values(value).every(number);
function optionalFields(value: RecordValue, keys: readonly string[], valid: (field: unknown) => boolean): boolean {
  return keys.every(key => value[key] === undefined || valid(value[key]));
}

export function validSavedState(value: unknown): boolean {
  if (!record(value) || !number(value.money) || !stringList(value.zones) ||
    !stringList(value.locations) || typeof value.activeLocation !== 'string') return false;
  if (!optionalFields(value, ['totalEarned', 'revenueEarned', 'reputation', 'goalIndex', 'goalProgress',
    'goalBase', 'prestigePoints', 'prestigeCount', 'dailyStreak', 'coupons', 'weekBase', 'festivalBase',
    'festivalGoalTarget', 'weekPrevServed', 'festPrevItem', 'changeCount', 'changeAt', 'playTime', 'tutorialStep'], number)) return false;
  if (!optionalFields(value, ['upgrades', 'staffCount', 'staffLevel', 'prestigeLevels', 'dailyBase',
    'regularVisits', 'regularMilestones', 'adBuffs', 'dailyPrevDone', 'statsBase'], numberMap)) return false;
  if (!optionalFields(value, ['seenLocations', 'cosmeticsOwned'], stringList)) return false;
  if (!optionalFields(value, ['dailyClaimed', 'vacuumHinted', 'upgradeOnboarded', 'staffOnboarded', 'weekClaimed', 'festivalClaimed'], field => typeof field === 'boolean')) return false;
  if (!optionalFields(value, ['dailyDay', 'weekKey', 'festivalWeek', 'festivalGoalId', 'changeDay'], field => typeof field === 'string')) return false;
  if (!optionalFields(value, ['staffByLocation', 'staffLevelByLocation'], field => record(field) && Object.values(field).every(numberMap))) return false;
  if (!optionalFields(value, ['staffHireDeposits'], field => record(field) && Object.values(field).every(roles =>
    record(roles) && Object.values(roles).every(deposit => record(deposit) && number(deposit.count) && number(deposit.paid))))) return false;
  if (!optionalFields(value, ['dailyMissionDone'], field => Array.isArray(field) && field.every(item => typeof item === 'boolean'))) return false;
  if (!optionalFields(value, ['dailyMissions'], field => Array.isArray(field) && field.every(item =>
    record(item) && typeof item.counter === 'string' && number(item.target)))) return false;
  if (!optionalFields(value, ['cosmetics'], field => record(field) && Object.values(field).every(item => typeof item === 'string'))) return false;
  if (value.stats !== undefined) {
    if (!record(value.stats)) return false;
    if (!optionalFields(value.stats, ['sold', 'orders', 'served', 'dashers', 'angry', 'stationUpgrades',
      'cleaned', 'tablesCleaned', 'mopped', 'refills'], number)) return false;
    if (!optionalFields(value.stats, ['produced', 'sale'], numberMap)) return false;
  }
  return true;
}

export function validSavedWorlds(value: unknown): boolean {
  if (!record(value)) return false;
  return Object.values(value).every(world => {
    if (!record(world)) return false;
    if (!optionalFields(world, ['hygiene', 'income'], number) || !optionalFields(world, ['pads'], numberMap)) return false;
    if (world.stations !== undefined) {
      if (!record(world.stations)) return false;
      for (const station of Object.values(world.stations)) {
        if (!record(station) || !optionalFields(station, ['s', 'c', 'o', 'p', 'm', 'mv', 't', 'd', 'k', 'cl'], number) ||
          !optionalFields(station, ['u'], numberMap) || !optionalFields(station, ['ct'], stringList)) return false;
      }
    }
    if (world.spills !== undefined) {
      if (!record(world.spills) || !Array.isArray(world.spills.s) || !world.spills.s.every(spill =>
        record(spill) && ['x', 'z', 'k', 'a'].every(key => typeof spill[key] === 'number' && Number.isFinite(spill[key])))) return false;
    }
    if (world.grime !== undefined) {
      const grime = world.grime;
      if (!record(grime) || !['c', 'w', 'h'].every(key => number(grime[key])) || typeof grime.d !== 'string') return false;
    }
    return true;
  });
}
