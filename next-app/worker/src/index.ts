type EncryptedRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
  iv: string;
  encryptedData: string;
};

type VaultManifest = {
  vaultId: string;
  authHash: string;
  createdAt: string;
  updatedAt: string;
  storageBytes: number;
  recentRequestIds: string[];
  records: Array<{
    id: string;
    updatedAt: string;
    deletedAt: string | null;
    deviceId: string;
    sizeBytes: number;
  }>;
};

type Env = {
  VAULTS: R2Bucket;
  IP_LIMITER?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
  VAULT_LIMITER?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
  TURNSTILE_SECRET?: string;
  ALLOW_INSECURE_DEV_CREATE?: string;
  MAX_REQUEST_BYTES?: string;
  MAX_VAULT_BYTES?: string;
  MAX_RECENT_REQUEST_IDS?: string;
  CORS_ORIGIN?: string;
};

const encoder = new TextEncoder();

function json(data: unknown, env: Env, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders(env, init.headers),
    }
  });
}

function text(message: string, env: Env, status = 400, headers?: HeadersInit) {
  return new Response(message, { status, headers: corsHeaders(env, headers) });
}

function corsHeaders(env: Env, headers?: HeadersInit) {
  return {
    'access-control-allow-origin': env.CORS_ORIGIN ?? 'http://localhost:4174',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-auth-hash,x-device-id,x-vault-id,x-request-id,x-timestamp,x-signature',
    ...(headers ?? {})
  };
}

function vaultManifestKey(vaultId: string) {
  return `vaults/${vaultId}/manifest.json`;
}

function vaultRecordKey(vaultId: string, recordId: string) {
  return `vaults/${vaultId}/records/${recordId}.json`;
}

async function sha256Base64Url(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes: Uint8Array) {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function hmacBase64Url(secret: Uint8Array, payload: string) {
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

async function readJson<T>(object: R2ObjectBody | null): Promise<T | null> {
  if (!object) return null;
  return await object.json<T>();
}

async function loadManifest(env: Env, vaultId: string) {
  return readJson<VaultManifest>(await env.VAULTS.get(vaultManifestKey(vaultId)));
}

async function putManifest(env: Env, manifest: VaultManifest) {
  await env.VAULTS.put(vaultManifestKey(manifest.vaultId), JSON.stringify(manifest), {
    httpMetadata: { contentType: 'application/json' }
  });
}

async function verifyRateLimit(binding: Env['IP_LIMITER'] | Env['VAULT_LIMITER'], key: string, message: string) {
  if (!binding) return;
  const result = await binding.limit({ key });
  if (!result.success) throw new Error(message);
}

async function verifyTurnstile(env: Env, token?: string, ip?: string | null) {
  if (!env.TURNSTILE_SECRET) {
    if (env.ALLOW_INSECURE_DEV_CREATE === '1') return;
    throw new Error('Turnstile not configured.');
  }
  if (!token) throw new Error('Missing Turnstile token.');

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  });
  const data = await response.json<{ success?: boolean }>();
  if (!data.success) throw new Error('Turnstile verification failed.');
}

function assertRecordShape(record: EncryptedRecord) {
  if (!record?.id || !record.updatedAt || !record.createdAt || !record.deviceId || !record.iv || !record.encryptedData) {
    throw new Error('Malformed record.');
  }
}

function compareIso(a: string, b: string) {
  return a.localeCompare(b);
}

async function verifySignedRequest(request: Request, manifest: VaultManifest | null, vaultId: string) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const authHashHeader = request.headers.get('x-auth-hash');
  const deviceId = request.headers.get('x-device-id');
  const requestId = request.headers.get('x-request-id');
  const timestamp = request.headers.get('x-timestamp');
  const signature = request.headers.get('x-signature');
  const headerVaultId = request.headers.get('x-vault-id');

  if (!bearer || !authHashHeader || !deviceId || !requestId || !timestamp || !signature || headerVaultId !== vaultId) {
    throw new Error('Missing auth headers.');
  }

  const ageMs = Math.abs(Date.now() - Date.parse(timestamp));
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60_000) throw new Error('Stale request.');

  const derivedHash = await sha256Base64Url(fromBase64(bearer));
  if (derivedHash !== authHashHeader) throw new Error('Bad auth token hash.');
  if (manifest && manifest.authHash !== derivedHash) throw new Error('Unauthorized vault token.');

  const bodyText = request.method === 'GET' ? '' : await request.clone().text();
  const payload = [request.method, new URL(request.url).pathname, timestamp, requestId, bodyText].join('\n');
  const derivedSignature = await hmacBase64Url(fromBase64(bearer), payload);
  if (signature !== derivedSignature) throw new Error('Bad request signature.');

  if (manifest?.recentRequestIds.includes(requestId)) throw new Error('Replay rejected.');

  return { authHash: derivedHash, deviceId, requestId, bodyText };
}

async function mergeRecords(env: Env, manifest: VaultManifest, incoming: EncryptedRecord[]) {
  const merged = new Map(manifest.records.map((record) => [record.id, record]));

  for (const record of incoming) {
    assertRecordShape(record);
    const sizeBytes = encoder.encode(JSON.stringify(record)).length;
    const existingMeta = merged.get(record.id);
    if (existingMeta && compareIso(record.updatedAt, existingMeta.updatedAt) < 0) continue;

    await env.VAULTS.put(vaultRecordKey(manifest.vaultId, record.id), JSON.stringify(record), {
      httpMetadata: { contentType: 'application/json' }
    });

    merged.set(record.id, {
      id: record.id,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      deviceId: record.deviceId,
      sizeBytes
    });
  }

  const records = Array.from(merged.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const storageBytes = records.reduce((sum, record) => sum + record.sizeBytes, 0);
  return { records, storageBytes };
}

async function loadSnapshot(env: Env, manifest: VaultManifest) {
  const records = await Promise.all(manifest.records.map(async (recordMeta) => {
    const record = await readJson<EncryptedRecord>(await env.VAULTS.get(vaultRecordKey(manifest.vaultId, recordMeta.id)));
    if (!record) throw new Error(`Missing record object ${recordMeta.id}`);
    return record;
  }));
  return { manifest, records };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env) });

    try {
      const url = new URL(request.url);
      const ip = request.headers.get('cf-connecting-ip') ?? 'local';
      const maxRequestBytes = Number(env.MAX_REQUEST_BYTES ?? 1_048_576);
      const maxVaultBytes = Number(env.MAX_VAULT_BYTES ?? 5_242_880);
      const maxRecentRequestIds = Number(env.MAX_RECENT_REQUEST_IDS ?? 100);

      await verifyRateLimit(env.IP_LIMITER, `ip:${ip}`, 'Too many requests from this IP.');

      if (request.method !== 'GET') {
        const contentLength = Number(request.headers.get('content-length') ?? 0);
        if (contentLength > maxRequestBytes) return text('Request too large.', env, 413);
      }

      if (request.method === 'POST' && url.pathname === '/v1/vaults') {
        const body = await request.json<{ vaultId?: string; authHash?: string; deviceId?: string; turnstileToken?: string }>();
        if (!body.vaultId || !body.authHash || !body.deviceId) return text('Missing vault create payload.', env, 400);
        await verifyTurnstile(env, body.turnstileToken, ip);
        const existing = await loadManifest(env, body.vaultId);
        if (existing) return json({ ok: true, existed: true }, env);

        const manifest: VaultManifest = {
          vaultId: body.vaultId,
          authHash: body.authHash,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          storageBytes: 0,
          recentRequestIds: [],
          records: []
        };
        await putManifest(env, manifest);
        return json({ ok: true, existed: false }, env, { status: 201 });
      }

      const match = url.pathname.match(/^\/v1\/vaults\/([a-f0-9]+)\/(snapshot|sync)$/);
      if (!match) return text('Not found.', env, 404);

      const [, vaultId, action] = match;
      await verifyRateLimit(env.VAULT_LIMITER, `vault:${vaultId}`, 'Too many requests for this vault.');
      const manifest = await loadManifest(env, vaultId);
      if (!manifest) return text('Vault not found.', env, 404);
      const verified = await verifySignedRequest(request, manifest, vaultId);

      if (action === 'snapshot' && request.method === 'GET') {
        return json(await loadSnapshot(env, manifest), env);
      }

      if (action === 'sync' && request.method === 'POST') {
        const body = verified.bodyText ? JSON.parse(verified.bodyText) as { records?: EncryptedRecord[] } : {};
        if (!Array.isArray(body.records)) return text('Missing records array.', env, 400);
        const merged = await mergeRecords(env, manifest, body.records);
        if (merged.storageBytes > maxVaultBytes) return text('Vault quota exceeded.', env, 413);

        const nextManifest: VaultManifest = {
          ...manifest,
          updatedAt: new Date().toISOString(),
          storageBytes: merged.storageBytes,
          recentRequestIds: [verified.requestId, ...manifest.recentRequestIds].slice(0, maxRecentRequestIds),
          records: merged.records
        };
        await putManifest(env, nextManifest);
        return json(await loadSnapshot(env, nextManifest), env);
      }

      return text('Method not allowed.', env, 405);
    } catch (error) {
      return text(error instanceof Error ? error.message : 'Worker error.', env, 400);
    }
  }
};
