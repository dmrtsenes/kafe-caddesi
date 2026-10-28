import assert from 'node:assert/strict';
import { it, afterEach } from 'node:test';
import { SaveManager, SAVE_KEY, BACKUP_KEY } from './SaveManager';
import { GameState } from '../sim/GameState';
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
function setup() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  });
  return values;
}
it('round-trips v8 progress and falls back to backup when the primary is corrupt', () => {
  const values = setup();
  const saves = new SaveManager();
  const state = new GameState();
  state.money = 4321.123456;
  state.tutorialStep = 7;
  assert.equal(saves.write({ state: state.save(), worlds: {} }), true);
  assert.equal(saves.read()?.state.money, 4321.123);
  const portable = saves.exportText()!;
  assert.ok(portable.startsWith('FSK1:'));
  values.set(SAVE_KEY, 'broken');
  assert.equal(saves.read()?.state.tutorialStep, 7);
  assert.equal(saves.importText(portable), true);
  const before = values.get(SAVE_KEY);
  assert.equal(saves.importText('invalid backup'), false);
  assert.equal(values.get(SAVE_KEY), before);
});
it('reset removes both game slots while keeping settings and language', async () => {
  const values = setup();
  const saves = new SaveManager();
  saves.write({ state: new GameState().save(), worlds: {} });
  values.set('fincan-sokagi:language:v1', 'en');
  values.set('fincan-sokagi:settings:v2', '{}');
  await saves.clear();
  assert.equal(values.has(SAVE_KEY), false);
  assert.equal(values.has(BACKUP_KEY), false);
  assert.equal(values.get('fincan-sokagi:language:v1'), 'en');
  assert.equal(values.get('fincan-sokagi:settings:v2'), '{}');
});

function portable(value: unknown): string {
  return 'FSK1:' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}
function validSave() {
  return { v: 8, t: Date.now(), state: new GameState().save(), worlds: {} as Record<string, unknown> };
}
it('an imported game replaces both slots, including immediate recovery after import', () => {
  const values = setup();
  const saves = new SaveManager();
  saves.write({ state: new GameState().save(), worlds: {} });
  const imported = validSave();
  imported.state.money = 97531;
  assert.equal(saves.importText(portable(imported)), true);
  values.set(SAVE_KEY, 'interrupted write');
  assert.equal(new SaveManager().read()?.state.money, 97531);
});
it('exports the healthy recovery slot when the primary is damaged', () => {
  const values = setup();
  const saves = new SaveManager();
  const state = new GameState();
  state.money = 2468;
  saves.write({ state: state.save(), worlds: {} });
  values.set(SAVE_KEY, 'broken');
  const exported = saves.exportText();
  assert.ok(exported);
  assert.equal(saves.importText(exported), true);
  assert.equal(saves.read()?.state.money, 2468);
});
it('rejects damaged shapes without replacing a working game or its recovery slot', () => {
  const values = setup();
  const saves = new SaveManager();
  saves.write({ state: new GameState().save(), worlds: {} });
  const mutations: ((value: any) => void)[] = [
    value => { value.state = []; },
    value => { value.state = {}; },
    value => { value.state.money = 'lots'; },
    value => { value.state.stats.sale = { cay: null }; },
    value => { value.state.staffByLocation = { kose: null }; },
    value => { value.worlds = []; },
    value => { value.worlds.kose = { stations: { counter: { m: '12' } } }; },
    value => { value.worlds.kose = { stations: {}, spills: { s: [null] } }; },
    value => { value.worlds.kose = { stations: {}, spills: { s: [{ x: 1, z: 'bad', k: 2, a: 1 }] } }; },
    value => { value.v = 7; },
    value => { value.v = 8.5; },
    value => { value.v = 9; },
  ];
  const main = values.get(SAVE_KEY);
  const backup = values.get(BACKUP_KEY);
  for (const mutate of mutations) {
    const damaged = validSave();
    mutate(damaged);
    assert.equal(saves.importText(portable(damaged)), false);
    assert.equal(values.get(SAVE_KEY), main);
    assert.equal(values.get(BACKUP_KEY), backup);
  }
});
it('treats a structurally corrupt main as damage and loads the working backup', () => {
  const values = setup();
  const saves = new SaveManager();
  const state = new GameState();
  state.money = 888;
  saves.write({ state: state.save(), worlds: {} });
  const damaged = validSave();
  damaged.worlds.kose = { stations: {}, spills: { s: [null] } };
  values.set(SAVE_KEY, JSON.stringify(damaged));
  assert.equal(saves.read()?.state.money, 888);
});
it('rolls back the prepared backup if the main slot cannot be written', () => {
  const values = setup();
  const saves = new SaveManager();
  saves.write({ state: new GameState().save(), worlds: {} });
  const before = new Map(values);
  const store = globalThis.localStorage;
  const originalSet = store.setItem;
  store.setItem = (key: string, value: string) => {
    if (key === SAVE_KEY) throw new Error('disk unavailable');
    originalSet(key, value);
  };
  const imported = validSave();
  imported.state.money = 4444;
  assert.equal(saves.importText(portable(imported)), false);
  assert.deepEqual(values, before);
});
it('retains early v8 saves with absent newer optional fields and fixes invalid time', () => {
  setup();
  const saves = new SaveManager();
  const early = { v: 8, t: 'unknown', state: { money: 5, zones: ['kose:a1'], locations: ['kose'], activeLocation: 'kose' } };
  assert.equal(saves.importText(portable(early)), true);
  assert.equal(saves.read()?.state.money, 5);
  assert.ok(Number.isFinite(saves.read()?.t));
});

it('keeps existing progress readable when storage is full and retries a later save', () => {
  const values = setup();
  const original = new SaveManager();
  const state = new GameState();
  state.money = 13579;
  original.write({ state: state.save(), worlds: {} });
  const storage = globalThis.localStorage;
  const setItem = storage.setItem;
  storage.setItem = () => { throw new Error('quota full'); };
  const full = new SaveManager();
  assert.equal(full.isAvailable, false);
  assert.equal(full.read()?.state.money, 13579);
  assert.ok(full.exportText()?.startsWith('FSK1:'));
  assert.equal(full.write({ state: state.save(), worlds: {} }), false);
  storage.setItem = setItem;
  state.money = 24680;
  assert.equal(full.write({ state: state.save(), worlds: {} }), true);
  assert.equal(full.isAvailable, true);
  assert.equal(full.read()?.state.money, 24680);
});

it('does not overwrite either healthy slot with an invalid runtime snapshot', () => {
  const values = setup();
  const saves = new SaveManager();
  const state = new GameState();
  state.money = 2222;
  saves.write({ state: state.save(), worlds: {} });
  const before = new Map(values);
  state.money = Number.NaN;
  assert.equal(saves.write({ state: state.save(), worlds: {} }), false);
  assert.deepEqual(values, before);
  assert.equal(saves.read()?.state.money, 2222);
});

it('retries a failed backup at the next save instead of delaying recovery for five minutes', () => {
  const values = setup();
  const saves = new SaveManager();
  const storage = globalThis.localStorage;
  const setItem = storage.setItem;
  storage.setItem = (key: string, value: string) => {
    if (key === BACKUP_KEY) throw new Error('temporary backup write error');
    setItem(key, value);
  };
  const state = new GameState();
  state.money = 555;
  assert.equal(saves.write({ state: state.save(), worlds: {} }), true);
  assert.equal(values.has(BACKUP_KEY), false);
  storage.setItem = setItem;
  assert.equal(saves.write({ state: state.save(), worlds: {} }), true);
  assert.equal(JSON.parse(values.get(BACKUP_KEY)!).state.money, 555);
});
