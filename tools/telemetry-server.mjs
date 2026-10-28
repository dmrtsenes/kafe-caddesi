import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EVENT_NAMES = new Set([
  'session_start',
  'session_end',
  'active_day',
  'tutorial_step',
  'tutorial_complete',
  'tutorial_skip',
  'first_order',
  'first_serve',
  'first_cash',
  'first_table_clean',
  'zone_unlock',
  'staff_hire',
  'upgrade',
  'ad_requested',
  'ad_result',
  'performance',
]);
const FIELDS = new Set([
  'location',
  'step',
  'play_seconds',
  'served',
  'orders',
  'fps',
  'quality',
  'day',
  'age_days',
  'resumed',
  'zone',
  'role',
  'count',
  'kind',
  'id',
  'level',
  'placement',
  'rewarded',
  'language',
]);
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(value);
export function validateEnvelope(body) {
  if (
    !body ||
    body.schema !== 1 ||
    !id(body.install) ||
    typeof body.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(body.version)
  )
    return false;
  if (
    !Number.isFinite(body.firstSeen) ||
    body.firstSeen < 0 ||
    !Array.isArray(body.events) ||
    body.events.length < 1 ||
    body.events.length > 20
  )
    return false;
  return body.events.every(
    (e) =>
      e &&
      id(e.id) &&
      id(e.session) &&
      EVENT_NAMES.has(e.name) &&
      Number.isFinite(e.at) &&
      e.at >= body.firstSeen &&
      Number.isFinite(e.elapsed) &&
      e.elapsed >= 0 &&
      e.props &&
      typeof e.props === 'object' &&
      !Array.isArray(e.props) &&
      Object.keys(e.props).length <= 20 &&
      Object.entries(e.props).every(
        ([key, value]) =>
          FIELDS.has(key) &&
          (typeof value === 'boolean' ||
            (typeof value === 'string' && value.length <= 80) ||
            (typeof value === 'number' && Number.isFinite(value))),
      ),
  );
}
export function createTelemetryServer({
  file = resolve('.local-data/telemetry.ndjson'),
  origins = ['http://localhost:5173', 'http://127.0.0.1:5192'],
} = {}) {
  const allowed = new Set(origins),
    seen = new Set(),
    rates = new Map();
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file)) {
    if (statSync(file).size > 50 * 1024 * 1024)
      throw new Error('Rotate the telemetry file before starting (50 MB limit).');
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      try {
        const e = JSON.parse(line);
        seen.add(e.install + ':' + e.id);
      } catch {}
    }
  }
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  async function handle(req, res) {
    const origin = req.headers.origin;
    res.setHeader('Cache-Control', 'no-store');
    if (origin && !allowed.has(origin)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    if (req.method !== 'POST' || req.url !== '/events') {
      res.writeHead(404);
      res.end();
      return;
    }
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
      res.writeHead(415);
      res.end();
      return;
    }
    const now = Date.now(),
      peer = req.socket.remoteAddress ?? 'unknown';
    for (const [key, value] of rates) if (now - value.at > 60000) rates.delete(key);
    const rate = rates.get(peer) ?? { at: now, count: 0 };
    rates.set(peer, rate);
    if (++rate.count > 300) {
      res.writeHead(429, { 'Retry-After': '60' });
      res.end();
      return;
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (!validateEnvelope(body)) {
      res.writeHead(400);
      res.end();
      return;
    }
    if (existsSync(file) && statSync(file).size > 50 * 1024 * 1024) {
      res.writeHead(507);
      res.end();
      return;
    }
    const batch = new Set();
    const unique = body.events.filter((e) => {
      const key = body.install + ':' + e.id;
      if (seen.has(key) || batch.has(key)) return false;
      batch.add(key);
      return true;
    });
    if (unique.length) {
      const rows = unique.map(({ id, name, at, session, elapsed, props }) => ({
        receivedAt: now,
        version: body.version,
        install: body.install,
        firstSeen: body.firstSeen,
        id,
        name,
        at,
        session,
        elapsed,
        props,
      }));
      appendFileSync(file, rows.map((e) => JSON.stringify(e)).join('\n') + '\n');
      for (const e of unique) seen.add(body.install + ':' + e.id);
    }
    res.writeHead(204);
    res.end();
  }
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const origins = (process.env.TELEMETRY_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5192')
    .split(',')
    .map((v) => v.trim());
  const server = createTelemetryServer({
    origins,
    file: process.env.TELEMETRY_FILE ? resolve(process.env.TELEMETRY_FILE) : undefined,
  });
  const port = Number(process.env.TELEMETRY_PORT ?? 8787);
  server.listen(port, '127.0.0.1', () =>
    console.log('Local telemetry collector: http://127.0.0.1:' + port + '/events'),
  );
}
