import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Exercise the real bridge functions with a deterministic platform adapter; no device data is used.
Capacitor.isNativePlatform = () => true;
const data = new Map<string, string>();
let beforeWrite: (() => Promise<void>) | undefined;
let exitCount = 0;
let removed = 0;
let rejectEvents = false;
const listeners = new Map<string, (event: any) => void>();
registerPlugin('Preferences', { web: () => ({
  get: async ({ key }: { key: string }) => ({ value: data.get(key) ?? null }),
  set: async ({ key, value }: { key: string; value: string }) => { await beforeWrite?.(); data.set(key, value); },
  remove: async ({ key }: { key: string }) => { data.delete(key); },
}) });
registerPlugin('App', { web: () => ({
  addListener: async (event: string, handler: (value: unknown) => void) => {
    if (rejectEvents) throw new Error('native listener unavailable');
    listeners.set(event, handler);
    return { remove: async () => { removed++; listeners.delete(event); } };
  },
  exitApp: async () => { exitCount++; },
}) });
registerPlugin('Haptics', { web: () => ({
  impact: async () => { throw new Error('no vibrator'); },
  notification: async () => { throw new Error('no vibrator'); },
}) });
const native = await import('./Native');
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
const originalStore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(async () => {
  await native.flushStorage();
  data.clear(); beforeWrite = undefined; exitCount = 0; removed = 0; rejectEvents = false; listeners.clear();
  if (originalStore) Object.defineProperty(globalThis, 'localStorage', originalStore); else Reflect.deleteProperty(globalThis, 'localStorage');
});
it('hydrates missing web slots while keeping the active local game', async () => {
  const local = new Map([['main', 'local-current']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => local.get(key) ?? null, setItem: (key: string, value: string) => local.set(key, value),
  } });
  data.set('main', 'older-native'); data.set('backup', 'safe-native');
  await native.hydrateStorage(['main', 'backup']);
  assert.equal(local.get('main'), 'local-current');
  assert.equal(local.get('backup'), 'safe-native');
});
it('a delayed native write cannot recreate a game after reset', async () => {
  let release!: () => void;
  beforeWrite = () => new Promise<void>(resolve => { release = resolve; });
  const writing = native.mirrorStorage('main', 'old-game');
  await turn();
  const clearing = native.clearStorage('main');
  release();
  await Promise.all([writing, clearing, native.flushStorage()]);
  assert.equal(data.has('main'), false);
});
it('a failed native write does not block a later successful save', async () => {
  beforeWrite = async () => { throw new Error('temporary device error'); };
  await native.mirrorStorage('main', 'failed');
  beforeWrite = undefined;
  await native.mirrorStorage('main', 'recovered');
  await native.flushStorage();
  assert.equal(data.get('main'), 'recovered');
});
it('back navigation closes a panel before exit and flushes one final game only once', async () => {
  let panel = true; let prompts = 0; let saved = 0;
  const detach = native.onBackButton(() => { if (!panel) return false; panel = false; return true; },
    () => { prompts++; }, () => { saved++; void native.mirrorStorage('main', 'latest'); });
  await turn();
  const back = listeners.get('backButton')!;
  back({}); assert.equal(prompts, 0);
  back({}); assert.equal(prompts, 1);
  back({}); back({});
  await turn(); await native.flushStorage(); await turn();
  assert.equal(saved, 1); assert.equal(exitCount, 1); assert.equal(data.get('main'), 'latest');
  detach(); await turn();
});
it('disposed app and back listeners ignore callbacks before asynchronous removal finishes', async () => {
  let calls = 0;
  const detachState = native.onAppStateChange(() => { calls++; });
  const detachBack = native.onBackButton(() => { calls++; return false; }, () => {});
  await turn();
  const state = listeners.get('appStateChange')!; const back = listeners.get('backButton')!;
  detachState(); detachBack();
  state({ isActive: false }); back({});
  await turn();
  assert.equal(calls, 0); assert.equal(removed, 2);
});
it('unsupported native vibration and listener failures remain handled', async () => {
  native.haptic('light'); native.haptic('success'); native.haptic('warning');
  rejectEvents = true;
  const detachState = native.onAppStateChange(() => {});
  const detachBack = native.onBackButton(() => false, () => {});
  await turn();
  detachState(); detachBack();
  await turn();
});
