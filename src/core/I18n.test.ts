import assert from 'node:assert/strict';
import { it, afterEach } from 'node:test';
import english from '../i18n/en.json' with { type: 'json' };
import { setLanguage, getLanguage, initializeLanguage, tr } from './I18n';
import { formatMoney, formatCompactMoney, formatDuration, formatPct } from './MathUtils';
import { ENDLESS_TEMPLATES } from '../data/goals';
import { FESTIVALS, festivalGoalTitle } from '../sim/Festival';
afterEach(() => setLanguage('tr'));
it('every English translation preserves the source interpolation contract', () => {
  const tokens = (s: string) => [...new Set(s.match(/\{\d+\}/g) ?? [])].sort();
  for (const [source, translation] of Object.entries(english)) {
    assert.ok(translation.trim(), source);
    assert.deepEqual(tokens(translation), tokens(source), source);
  }
});
it('switches labels, interpolation, amounts and durations together', () => {
  setLanguage('tr');
  assert.equal(formatCompactMoney(1100), '1.100');
  assert.equal(formatMoney(1100), '1.100');
  assert.equal(formatCompactMoney(12500), '12,5 bin');
  assert.equal(formatMoney(12500), '12,5 bin');
  assert.equal(/B/.test(formatCompactMoney(1100)), false);
  assert.equal(/B/.test(formatMoney(12500)), false);
  assert.equal(formatPct(0.42), '%42');
  assert.equal(formatDuration(65), '1 dk 5 sn');
  setLanguage('en');
  assert.equal(formatCompactMoney(1100), '1,100');
  assert.equal(formatMoney(1100), '1,100');
  assert.equal(getLanguage(), 'en');
  assert.equal(formatCompactMoney(12500), '12.5K');
  assert.equal(formatMoney(12500), '12.5K');
  assert.equal(formatMoney(3400000000), '3.40B');
  assert.equal(formatPct(0.42), '42%');
  assert.equal(formatDuration(65), '1 min 5 s');
  assert.equal(tr('Unknown {0}', 7), 'Unknown 7');
});
it('falls back safely when preferences are unavailable', () => {
  assert.doesNotThrow(() => initializeLanguage());
  assert.ok(['tr', 'en'].includes(getLanguage()));
});

it('keeps Turkish for existing Turkish-only saves and stores the language choice', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map([['fincan-sokagi:save:v8', '{}']]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    },
  });
  try {
    setLanguage('en');
    values.delete('fincan-sokagi:language:v1');
    initializeLanguage();
    assert.equal(getLanguage(), 'tr');
    assert.equal(values.get('fincan-sokagi:language:v1'), 'tr');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

it('localizes generated festival and endless goals without leaving Turkish verbs in English', () => {
  const tea = FESTIVALS.find((festival) => festival.itemId === 'cay');
  const clean = FESTIVALS.find((festival) => festival.kind === 'clean');
  const guest = FESTIVALS.find((festival) => festival.kind === 'guest');
  assert.ok(tea && clean && guest);
  const mop = ENDLESS_TEMPLATES.find((template) => template.kind === 'mop');
  const refill = ENDLESS_TEMPLATES.find((template) => template.kind === 'refill');
  assert.ok(mop && refill);

  setLanguage('tr');
  assert.equal(festivalGoalTitle(tea, 120), '120 Çay sat');
  assert.equal(mop.title(180), '180 leke daha temizle');
  assert.equal(refill.title(120), '120 sarf malzemesi doldur');

  setLanguage('en');
  assert.equal(festivalGoalTitle(tea, 120), 'Sell 120 Tea');
  assert.equal(festivalGoalTitle(clean, 60), 'Complete 60 cleaning jobs');
  assert.equal(festivalGoalTitle(guest, 100), 'Complete 100 orders');
  assert.equal(mop.title(180), 'Clean 180 more spills');
  assert.equal(refill.title(120), 'Restock 120 supplies');
});

it('all literal runtime translation calls have English entries', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const ts = (await import('typescript')).default;
  const missing: string[] = [];
  const entries: Record<string, string> = english;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = dir + '/' + entry.name;
      if (entry.isDirectory()) { walk(path); continue; }
      if (!path.endsWith('.ts') || path.endsWith('.test.ts')) continue;
      const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (node: import('typescript').Node): void => {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'tr') {
          const key = node.arguments[0];
          if (key && (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) && !entries[key.text])
            missing.push(path + ': ' + key.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  };
  walk('src');
  assert.deepEqual(missing, []);
});
