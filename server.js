import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { getAuthConfig } from './auth-config.js';

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
const DB_PATH = process.env.DATABASE_PATH || join(DATA_DIR, 'finance-tracker.sqlite');
const BACKUP_DIR = process.env.BACKUP_DIR || join(DATA_DIR, 'backups');
const BACKUP_RETENTION_DAYS = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 7));
const {
  username: AUTH_USERNAME,
  password: AUTH_PASSWORD,
  sessionSecret: SESSION_SECRET,
  enabled: AUTH_ENABLED
} = getAuthConfig(process.env);
const SESSION_COOKIE = 'finance_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const STOP_TOKEN = process.env.STOP_TOKEN || '';

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    payment_method TEXT,
    notes TEXT,
    needs_review INTEGER DEFAULT 0,
    review_reason TEXT
  );
`);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendHtml(res, status, html, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(html);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value) {
  return createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function createSessionToken(username) {
  const payload = JSON.stringify({
    username,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    nonce: randomBytes(16).toString('base64url')
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(cookie => {
    const [key, ...value] = cookie.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }));
}

function isAuthenticated(req) {
  if (!AUTH_ENABLED) return true;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes('.')) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.username === AUTH_USERNAME && Number(session.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function getCookieFlags(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const secure = forwardedProto === 'https' || req.socket.encrypted;
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure ? '; Secure' : ''}`;
}

function renderLoginPage(error = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login | Finance Tracker</title>
  <style>
    :root { color-scheme: dark; --bg: #0d0f0b; --panel: #171b14; --text: #f3f5ee; --muted: #aab19f; --accent: #d6ff65; --danger: #ff8d7c; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at top left, #243019, var(--bg) 45%); color: var(--text); }
    main { width: min(420px, calc(100vw - 32px)); padding: 32px; border: 1px solid #31382a; border-radius: 24px; background: color-mix(in srgb, var(--panel) 92%, transparent); box-shadow: 0 28px 80px rgba(0,0,0,.38); }
    h1 { margin: 0 0 8px; font-size: 32px; letter-spacing: -0.04em; }
    p { margin: 0 0 28px; color: var(--muted); line-height: 1.5; }
    label { display: block; margin: 18px 0 8px; color: var(--muted); font-weight: 700; }
    input { width: 100%; border: 1px solid #3f4935; border-radius: 14px; padding: 14px 16px; background: #0b0d09; color: var(--text); font: inherit; }
    button { width: 100%; margin-top: 24px; border: 0; border-radius: 14px; padding: 14px 16px; background: var(--accent); color: #12160d; font: inherit; font-weight: 900; cursor: pointer; }
    .error { color: var(--danger); margin-bottom: 0; }
  </style>
</head>
<body>
  <main>
    <h1>Finance Tracker</h1>
    <p>Login is required before viewing or changing transaction data.</p>
    ${error ? `<p class="error">${error}</p>` : ''}
    <form method="post" action="/login">
      <label for="username">Username</label>
      <input id="username" name="username" autocomplete="username" required autofocus>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Login</button>
    </form>
  </main>
</body>
</html>`;
}

function requireAuth(req, res) {
  if (isAuthenticated(req)) return true;
  if (req.url.startsWith('/api/')) {
    sendJson(res, 401, { error: 'Authentication required' });
  } else {
    sendHtml(res, 401, renderLoginPage());
  }
  return false;
}

function getTransactions() {
  return db.prepare(`
    SELECT amount, reason, date, category, subcategory, payment_method, notes, needs_review, review_reason
    FROM transactions
    ORDER BY date ASC, id ASC
  `).all().map(row => ({
    amount: row.amount,
    reason: row.reason,
    date: row.date,
    category: row.category,
    subcategory: row.subcategory || '',
    payment_method: row.payment_method || 'Other',
    notes: row.notes || '',
    needs_review: Boolean(row.needs_review),
    review_reason: row.review_reason || ''
  }));
}

function pruneBackups(now = Date.now()) {
  const cutoff = now - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(BACKUP_DIR)) {
    const filePath = join(BACKUP_DIR, name);
    const stats = statSync(filePath);
    if (stats.isFile() && stats.mtimeMs < cutoff) rmSync(filePath);
  }
}

function createBackup(reason, transactions) {
  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[:.]/g, '-');
  const jsonPath = join(BACKUP_DIR, `transactions-${stamp}.json`);
  const sqlitePath = join(BACKUP_DIR, `finance-tracker-${stamp}.sqlite`);

  writeFileSync(jsonPath, JSON.stringify({ createdAt, reason, count: transactions.length, transactions }, null, 2));
  copyFileSync(DB_PATH, sqlitePath);
  pruneBackups();

  return {
    createdAt,
    file: jsonPath.split('/').pop(),
    jsonPath,
    sqlitePath,
    retentionDays: BACKUP_RETENTION_DAYS
  };
}

function listBackups() {
  pruneBackups();

  return readdirSync(BACKUP_DIR)
    .filter(name => name.startsWith('transactions-') && name.endsWith('.json'))
    .map(name => {
      const filePath = join(BACKUP_DIR, name);
      const stats = statSync(filePath);
      let parsed = {};

      try {
        parsed = JSON.parse(readFileSync(filePath, 'utf8'));
      } catch {}

      const transactions = Array.isArray(parsed) ? parsed : Array.isArray(parsed.transactions) ? parsed.transactions : [];

      return {
        file: name,
        createdAt: parsed.createdAt || new Date(stats.mtimeMs).toISOString(),
        reason: parsed.reason || 'backup',
        count: Number.isFinite(parsed.count) ? parsed.count : transactions.length,
        size: stats.size
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function readBackupTransactions(file) {
  if (!file || file !== file.split('/').pop() || !file.endsWith('.json')) {
    throw new Error('Invalid backup file');
  }

  const filePath = join(BACKUP_DIR, file);
  if (!existsSync(filePath)) throw new Error('Backup not found');

  const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  const transactions = Array.isArray(parsed) ? parsed : parsed.transactions;
  if (!Array.isArray(transactions)) throw new Error('Backup is invalid');
  return transactions;
}

function replaceTransactions(transactions, backupReason = 'transactions-put') {
  const insert = db.prepare(`
    INSERT INTO transactions (
      amount, reason, date, category, subcategory, payment_method, notes, needs_review, review_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM transactions');
    for (const item of transactions) {
      insert.run(
        Number(item.amount),
        String(item.reason || ''),
        String(item.date || ''),
        String(item.category || ''),
        item.subcategory ? String(item.subcategory) : '',
        item.payment_method ? String(item.payment_method) : 'Other',
        item.notes ? String(item.notes) : '',
        item.needs_review ? 1 : 0,
        item.review_reason ? String(item.review_reason) : ''
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return createBackup(backupReason, getTransactions());
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = resolve(ROOT, `.${pathname}`);
  const basename = pathname.split('/').pop() || '';

  if (
    !filePath.startsWith(ROOT) ||
    pathname.startsWith('/data/') ||
    pathname.startsWith('/.git/') ||
    basename.startsWith('.') ||
    !existsSync(filePath)
  ) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const contentType = mimeTypes[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/api/health') {
      sendJson(res, 200, { ok: true, auth: AUTH_ENABLED });
      return;
    }

    if (req.url === '/login' && req.method === 'GET') {
      if (isAuthenticated(req)) {
        res.writeHead(302, { Location: '/' });
        res.end();
      } else {
        sendHtml(res, 200, renderLoginPage());
      }
      return;
    }

    if (req.url === '/login' && req.method === 'POST') {
      const body = new URLSearchParams(await readBody(req));
      const username = String(body.get('username') || '');
      const password = String(body.get('password') || '');
      const valid = AUTH_ENABLED && safeEqual(username, AUTH_USERNAME) && safeEqual(password, AUTH_PASSWORD);

      if (!valid) {
        sendHtml(res, 401, renderLoginPage('Invalid username or password.'));
        return;
      }

      res.writeHead(302, {
        Location: '/',
        'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(createSessionToken(username))}; ${getCookieFlags(req)}`
      });
      res.end();
      return;
    }

    if (req.url === '/logout') {
      res.writeHead(302, {
        Location: '/login',
        'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
      });
      res.end();
      return;
    }

    if (!requireAuth(req, res)) return;

    if (req.url === '/api/transactions' && req.method === 'GET') {
      sendJson(res, 200, getTransactions());
      return;
    }

    if (req.url === '/api/backups' && req.method === 'GET') {
      sendJson(res, 200, listBackups());
      return;
    }

    if (req.url === '/api/transactions' && req.method === 'PUT') {
      const body = await readBody(req);
      const transactions = JSON.parse(body || '[]');
      if (!Array.isArray(transactions)) {
        sendJson(res, 400, { error: 'Expected a JSON array' });
        return;
      }
      const backup = replaceTransactions(transactions);
      sendJson(res, 200, { ok: true, count: transactions.length, backup });
      return;
    }

    if (req.url === '/api/backups/restore' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const file = String(body.file || '');
      const restoredTransactions = readBackupTransactions(file);
      const previousBackup = createBackup(`pre-restore:${file}`, getTransactions());
      const backup = replaceTransactions(restoredTransactions, `restore:${file}`);
      sendJson(res, 200, { ok: true, restoredFrom: file, count: restoredTransactions.length, previousBackup, backup });
      return;
    }

    if (req.url === '/api/server/stop' && req.method === 'POST') {
      const authorized = isAuthenticated(req) || (STOP_TOKEN && req.headers['x-stop-token'] === STOP_TOKEN);
      if (!authorized) {
        sendJson(res, 403, { error: 'Forbidden' });
        return;
      }

      sendJson(res, 200, { ok: true, stopping: true });
      setTimeout(() => {
        server.close(() => {
          db.close();
          process.exit(0);
        });
      }, 100);
      return;
    }

    serveStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Finance Tracker running at http://localhost:${PORT}`);
});
