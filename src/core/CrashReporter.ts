import {METRICS_CONSENT_KEY,validMetricsEndpoint} from './Telemetry';

const KEY = 'fincan-sokagi:diagnostics:v1';
const MAX_REPORTS = 8;

interface ClientErrorReport {
  at: string;
  message: string;
  stack?: string;
  platform: string;
}

function text(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function store(report: ClientErrorReport): void {
  try {
    const old = JSON.parse(localStorage.getItem(KEY) ?? '[]') as ClientErrorReport[];
    const list = Array.isArray(old) ? old.slice(-(MAX_REPORTS - 1)) : [];
    list.push(report);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* Tanılama hiçbir zaman oyunu düşürmez. */
  }

  const endpoint = validMetricsEndpoint(import.meta.env?.VITE_CRASH_REPORT_URL ?? '');
  try {if (!endpoint || localStorage.getItem(METRICS_CONSENT_KEY)!=='yes') return;} catch {return;}
  try {
    navigator.sendBeacon?.(endpoint, new Blob([JSON.stringify(report)], { type: 'application/json' }));
  } catch {
    /* Çevrimdışıysa cihazdaki kopya kalır. */
  }
}

/** WebView içindeki JS çökmelerini Play Vitals'ın kör noktasından kurtarır. */
export function installCrashReporter(): void {
  window.addEventListener('error', (event) => {
    store({
      at: new Date().toISOString(),
      message: event.message || text(event.error),
      stack: event.error instanceof Error ? event.error.stack?.slice(0, 2400) : undefined,
      platform: navigator.userAgent.slice(0, 240),
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    store({
      at: new Date().toISOString(),
      message: text(reason).slice(0, 800),
      stack: reason instanceof Error ? reason.stack?.slice(0, 2400) : undefined,
      platform: navigator.userAgent.slice(0, 240),
    });
  });
}

export function clearCrashDiagnostics(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yok */
  }
}
