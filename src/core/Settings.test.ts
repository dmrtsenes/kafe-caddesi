import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { Settings } from './Settings';
const originals = new Map(['localStorage', 'window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
afterEach(() => { for (const [key, descriptor] of originals) {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
} });
function setup(saved: Record<string, string> = {}) {
  const values = new Map(Object.entries(saved));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    devicePixelRatio: 2, innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: true }),
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Android', hardwareConcurrency: 4, deviceMemory: 2 } });
  return values;
}
const key = 'fincan-sokagi:settings:v2';
const legacy = 'fincan-sokagi:settings:v1';
it('uses device quality when a partial v2 preference has no valid quality tier', () => {
  setup({ [key]: JSON.stringify({ music: false, sfxVolume: 0.4 }) });
  const settings = new Settings();
  assert.equal(settings.get('quality'), 'low');
  assert.equal(settings.get('music'), false);
  assert.equal(settings.get('sfxVolume'), 0.4);
});
it('recovers valid old settings when a new slot is corrupt', () => {
  const values = setup({ [key]: 'broken', [legacy]: JSON.stringify({ muted: true, musicVolume: 0.15, quality: 'high', qualityAuto: false }) });
  const settings = new Settings();
  assert.equal(settings.get('muted'), true);
  assert.equal(settings.get('quality'), 'high');
  assert.equal(settings.get('qualityAuto'), false);
  assert.equal(JSON.parse(values.get(key)!).musicVolume, 0.15);
});
it('rejects scalar and array preference roots and applies first-open accessibility defaults', () => {
  for (const raw of ['null', 'true', '5', '[]', '[{ "quality": "high" }]']) {
    setup({ [key]: raw });
    const settings = new Settings();
    assert.equal(settings.get('quality'), 'low', raw);
    assert.equal(settings.get('reducedMotion'), true, raw);
  }
});
it('retains manual quality, frame cap, audio and accessibility through a new session', () => {
  setup();
  const first = new Settings();
  first.set('quality', 'high');
  first.set('qualityAuto', false);
  first.set('fps', 45);
  first.set('music', false);
  first.set('sfxVolume', 0.25);
  first.set('haptics', false);
  const next = new Settings();
  for (const key of ['quality', 'qualityAuto', 'fps', 'music', 'sfxVolume', 'haptics', 'reducedMotion'] as const)
    assert.equal(next.get(key), first.get(key));
});
