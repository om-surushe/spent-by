type EncryptedRecord = {
  id: string; createdAt: string; updatedAt: string; deletedAt: string | null;
  deviceId: string; iv: string; encryptedData: string;
};

type VaultRow = {
  vault_id: string; auth_hash: string; created_at: string; updated_at: string; storage_bytes: number;
};

type RecordRow = {
  id: string; created_at: string; updated_at: string; deleted_at: string | null;
  device_id: string; iv: string; encrypted_data: string; size_bytes: number;
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VAULT_ID = /^[a-f0-9]{32}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function corsHeaders(env: Env, headers?: HeadersInit) {
  return {
    'access-control-allow-origin': env.CORS_ORIGIN,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-auth-hash,x-device-id,x-vault-id,x-request-id,x-timestamp,x-signature',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...(headers ?? {})
  };
}

function json(data: unknown, env: Env, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: corsHeaders(env, init.headers) });
}

function text(message: string, env: Env, status: number) {
  return new Response(message, { status, headers: corsHeaders(env) });
}

function decodeBase64(value: string, urlSafe = false) {
  const normalized = urlSafe
    ? value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    : value;
  try { return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0)); }
  catch { throw new HttpError(401, 'Invalid authentication.'); }
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(value: Uint8Array) {
  const bytes = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

function safeEqual(left: string, right: string) {
  const a = encoder.encode(left); const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

async function parseBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) throw new HttpError(413, 'Request too large.');
  const bodyText = await request.text();
  if (encoder.encode(bodyText).length > maxBytes) throw new HttpError(413, 'Request too large.');
  return bodyText;
}

function assertRecord(record: EncryptedRecord) {
  if (!record || !UUID.test(record.id) || !UUID.test(record.deviceId)) throw new HttpError(400, 'Malformed record.');
  if (!Date.parse(record.createdAt) || !Date.parse(record.updatedAt)) throw new HttpError(400, 'Malformed record timestamp.');
  if (record.deletedAt !== null && !Date.parse(record.deletedAt)) throw new HttpError(400, 'Malformed deletion timestamp.');
  if (!BASE64.test(record.iv) || !BASE64.test(record.encryptedData)) throw new HttpError(400, 'Malformed encrypted payload.');
  if (decodeBase64(record.iv).byteLength !== 12) throw new HttpError(400, 'Malformed encryption IV.');
}

async function authenticate(request: Request, vault: VaultRow | null, vaultId: string, bodyText: string) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const authHash = request.headers.get('x-auth-hash');
  const deviceId = request.headers.get('x-device-id');
  const requestId = request.headers.get('x-request-id');
  const timestamp = request.headers.get('x-timestamp');
  const signature = request.headers.get('x-signature');
  if (!bearer || !authHash || !deviceId || !requestId || !UUID.test(deviceId) || !UUID.test(requestId) || !timestamp || !signature) {
    throw new HttpError(401, 'Invalid authentication.');
  }
  if (request.headers.get('x-vault-id') !== vaultId) throw new HttpError(401, 'Invalid authentication.');
  const ageMs = Math.abs(Date.now() - Date.parse(timestamp));
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60_000) throw new HttpError(401, 'Expired request.');

  const token = decodeBase64(bearer);
  const derivedHash = await sha256Base64Url(token);
  if (!safeEqual(derivedHash, authHash) || (vault && !safeEqual(vault.auth_hash, derivedHash))) {
    throw new HttpError(401, 'Invalid authentication.');
  }
  const key = await crypto.subtle.importKey('raw', token, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const payload = [request.method, new URL(request.url).pathname, timestamp, requestId, bodyText].join('\n');
  const valid = await crypto.subtle.verify('HMAC', key, decodeBase64(signature, true), encoder.encode(payload));
  if (!valid) throw new HttpError(401, 'Invalid authentication.');
  return { authHash: derivedHash, requestId };
}

async function getVault(env: Env, vaultId: string) {
  return env.DB.prepare('SELECT vault_id, auth_hash, created_at, updated_at, storage_bytes FROM vaults WHERE vault_id = ?')
    .bind(vaultId).first<VaultRow>();
}

async function snapshot(env: Env, vault: VaultRow) {
  const { results } = await env.DB.prepare(
    'SELECT id, created_at, updated_at, deleted_at, device_id, iv, encrypted_data, size_bytes FROM records WHERE vault_id = ? ORDER BY updated_at DESC'
  ).bind(vault.vault_id).all<RecordRow>();
  return {
    manifest: {
      vaultId: vault.vault_id, authHash: vault.auth_hash, createdAt: vault.created_at,
      updatedAt: vault.updated_at, storageBytes: vault.storage_bytes, recentRequestIds: [],
      records: results.map((row) => ({ id: row.id, updatedAt: row.updated_at, deletedAt: row.deleted_at, deviceId: row.device_id, sizeBytes: row.size_bytes }))
    },
    records: results.map((row) => ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at, deviceId: row.device_id, iv: row.iv, encryptedData: row.encrypted_data }))
  };
}

async function createVault(request: Request, env: Env, bodyText: string) {
  if (env.ALLOW_VAULT_CREATE !== '1') throw new HttpError(403, 'Vault creation is not enabled.');
  let body: { vaultId?: string; authHash?: string };
  try { body = JSON.parse(bodyText) as typeof body; } catch { throw new HttpError(400, 'Invalid JSON.'); }
  if (!body.vaultId || !VAULT_ID.test(body.vaultId) || !body.authHash) throw new HttpError(400, 'Invalid vault payload.');
  const existing = await getVault(env, body.vaultId);
  const auth = await authenticate(request, existing, body.vaultId, bodyText);
  if (!safeEqual(auth.authHash, body.authHash)) throw new HttpError(401, 'Invalid authentication.');
  const now = new Date().toISOString();
  let result;
  try {
    result = await env.DB.prepare(`INSERT INTO vaults (vault_id, auth_hash, created_at, updated_at, max_bytes)
      SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM vaults) < (SELECT max_vaults FROM app_limits WHERE id = 1)
      ON CONFLICT(vault_id) DO NOTHING`)
      .bind(body.vaultId, body.authHash, now, now, Number(env.MAX_VAULT_BYTES)).run();
  } catch (error) {
    if (error instanceof Error && error.message.includes('vault capacity reached')) {
      throw new HttpError(503, 'New vault capacity is currently full.');
    }
    throw error;
  }
  if (!result.meta.changes && !existing) throw new HttpError(503, 'New vault capacity is currently full.');
  return json({ ok: true, existed: !result.meta.changes }, env, { status: result.meta.changes ? 201 : 200 });
}

async function syncVault(env: Env, vault: VaultRow, bodyText: string, requestId: string) {
  let body: { records?: EncryptedRecord[] };
  try { body = JSON.parse(bodyText) as typeof body; } catch { throw new HttpError(400, 'Invalid JSON.'); }
  if (!Array.isArray(body.records)) throw new HttpError(400, 'Missing records array.');
  for (const record of body.records) assertRecord(record);
  const rows = body.records.map((record) => ({ ...record, sizeBytes: encoder.encode(JSON.stringify(record)).length }));
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO request_ids (vault_id, request_id, created_at) VALUES (?, ?, ?)').bind(vault.vault_id, requestId, now),
      env.DB.prepare(`INSERT INTO records (vault_id, id, created_at, updated_at, deleted_at, device_id, iv, encrypted_data, size_bytes)
        SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.createdAt'), json_extract(value, '$.updatedAt'), json_extract(value, '$.deletedAt'),
          json_extract(value, '$.deviceId'), json_extract(value, '$.iv'), json_extract(value, '$.encryptedData'), json_extract(value, '$.sizeBytes') FROM json_each(?) WHERE true
        ON CONFLICT(vault_id, id) DO UPDATE SET created_at = excluded.created_at, updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at, device_id = excluded.device_id, iv = excluded.iv,
          encrypted_data = excluded.encrypted_data, size_bytes = excluded.size_bytes
        WHERE excluded.updated_at > records.updated_at OR (excluded.updated_at = records.updated_at AND excluded.device_id > records.device_id)`)
        .bind(vault.vault_id, JSON.stringify(rows)),
      env.DB.prepare(`INSERT INTO quota_guard (value)
        SELECT 1 WHERE (SELECT COALESCE(SUM(size_bytes), 0) FROM records WHERE vault_id = ?)
          > (SELECT max_bytes FROM vaults WHERE vault_id = ?)`)
        .bind(vault.vault_id, vault.vault_id),
      env.DB.prepare('UPDATE vaults SET updated_at = ?, storage_bytes = (SELECT COALESCE(SUM(size_bytes), 0) FROM records WHERE vault_id = ?) WHERE vault_id = ?')
        .bind(now, vault.vault_id, vault.vault_id),
      env.DB.prepare('DELETE FROM request_ids WHERE vault_id = ? AND request_id NOT IN (SELECT request_id FROM request_ids WHERE vault_id = ? ORDER BY created_at DESC LIMIT 100)')
        .bind(vault.vault_id, vault.vault_id)
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed')) throw new HttpError(409, 'Replay rejected.');
    if (message.includes('CHECK constraint failed')) throw new HttpError(413, 'Vault quota exceeded.');
    throw error;
  }
  const updated = await getVault(env, vault.vault_id);
  if (!updated) throw new Error('Vault disappeared after sync.');
  return snapshot(env, updated);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const origin = request.headers.get('origin');
      if (origin && origin !== env.CORS_ORIGIN) throw new HttpError(403, 'Origin not allowed.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true, service: 'finance-vault', environment: env.ENVIRONMENT }, env);
      }
      const ip = request.headers.get('cf-connecting-ip') ?? 'local';
      if (env.IP_LIMITER && !(await env.IP_LIMITER.limit({ key: `ip:${ip}` })).success) throw new HttpError(429, 'Too many requests.');
      const bodyText = request.method === 'GET' ? '' : await parseBody(request, Number(env.MAX_REQUEST_BYTES));
      if (request.method === 'POST' && url.pathname === '/v1/vaults') return createVault(request, env, bodyText);
      const match = url.pathname.match(/^\/v1\/vaults\/([a-f0-9]{32})\/(snapshot|sync)$/);
      if (!match) throw new HttpError(404, 'Not found.');
      const [, vaultId, action] = match;
      if (env.VAULT_LIMITER && !(await env.VAULT_LIMITER.limit({ key: `vault:${vaultId}` })).success) throw new HttpError(429, 'Too many requests.');
      const vault = await getVault(env, vaultId);
      if (!vault) throw new HttpError(404, 'Vault not found.');
      const auth = await authenticate(request, vault, vaultId, bodyText);
      if (action === 'snapshot' && request.method === 'GET') return json(await snapshot(env, vault), env);
      if (action === 'sync' && request.method === 'POST') return json(await syncVault(env, vault, bodyText, auth.requestId), env);
      throw new HttpError(405, 'Method not allowed.');
    } catch (error) {
      if (error instanceof HttpError) return text(error.message, env, error.status);
      console.error(JSON.stringify({ event: 'worker_error', message: error instanceof Error ? error.message : 'unknown' }));
      return text('Internal server error.', env, 500);
    }
  }
} satisfies ExportedHandler<Env>;
