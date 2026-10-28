import english from '../i18n/en.json' with { type: 'json' };
export type Language = 'tr' | 'en';
export const LANGUAGE_KEY = 'fincan-sokagi:language:v1';
let language: Language = 'tr';
export function initializeLanguage(): void {
  const fallback: Language =
    typeof document !== 'undefined' && !navigator.language.toLowerCase().startsWith('tr') ? 'en' : 'tr';
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    // Builds before 1.2.0 were Turkish-only; keep that language on upgrade.
    language =
      saved === 'tr' || saved === 'en'
        ? saved
        : localStorage.getItem('fincan-sokagi:save:v8')
          ? 'tr'
          : fallback;
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    language = fallback;
  }
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}
initializeLanguage();
export function getLanguage(): Language {
  return language;
}
export function localeTag(): string {
  return language === 'en' ? 'en-US' : 'tr-TR';
}
export function setLanguage(next: Language): void {
  language = next;
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch {}
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}
const translations: Readonly<Record<string, string>> = english;
const PLACEHOLDER = /\{(\d+)\}/g;
export function tr(source: string, ...values: (string | number)[]): string {
  const template = language === 'en' ? (translations[source] ?? source) : source;
  // Without values every placeholder stays as written; skip the regex pass.
  if (values.length === 0) return template;
  return template.replace(PLACEHOLDER, (token, index) =>
    values[Number(index)] === undefined ? token : String(values[Number(index)]),
  );
}

const DECIMAL_FORMATS = new Map<string, Intl.NumberFormat>();
/**
 * Same output as `value.toLocaleString(locale, { maximumFractionDigits })`,
 * which builds a new ICU formatter on every call when options are passed.
 */
export function formatDecimal(value: number, maximumFractionDigits: number, locale = localeTag()): string {
  const key = locale + maximumFractionDigits;
  let format = DECIMAL_FORMATS.get(key);
  if (!format) DECIMAL_FORMATS.set(key, format = new Intl.NumberFormat(locale, { maximumFractionDigits }));
  return format.format(value);
}
