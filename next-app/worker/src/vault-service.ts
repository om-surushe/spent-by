import { authenticate, safeEqual } from './auth';
import { HttpError } from './errors';
import { encoder, json } from './http';
import { getVault, snapshot } from './store';
import type { EncryptedRecord, VaultRow } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VAULT_ID = /^[a-f0-9]{32}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeBase64(value: string) {
  try {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  } catch {
    throw new HttpError(400, 'Malformed encrypted payload.');
  }
}

function assertRecord(record: EncryptedRecord) {
  if (!record || !UUID.test(record.id) || !UUID.test(record.deviceId)) throw new HttpError(400, 'Malformed record.');
  if (!Date.parse(record.createdAt) || !Date.parse(record.updatedAt)) throw new HttpError(400, 'Malformed record timestamp.');
  if (record.deletedAt !== null && !Date.parse(record.deletedAt)) throw new HttpError(400, 'Malformed deletion timestamp.');
  if (!BASE64.test(record.iv) || !BASE64.test(record.encryptedData)) throw new HttpError(400, 'Malformed encrypted payload.');
  if (decodeBase64(record.iv).byteLength !== 12) throw new HttpError(400, 'Malformed encryption IV.');
}

export async function createVault(request: Request, env: Env, bodyText: string) {
  if (env.ALLOW_VAULT_CREATE !== '1') throw new HttpError(403, 'Vault creation is not enabled.');
  let body: { vaultId?: string; authHash?: string };
  try {
    body = JSON.parse(bodyText) as typeof body;
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
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
      .bind(body.vaultId, body.authHash, now, now, Number(env.MAX_VAULT_BYTES))
      .run();
  } catch (error) {
    if (error instanceof Error && error.message.includes('vault capacity reached')) {
      throw new HttpError(503, 'New vault capacity is currently full.');
    }
    throw error;
  }

  if (!result.meta.changes && !existing) throw new HttpError(503, 'New vault capacity is currently full.');
  return json({ ok: true, existed: !result.meta.changes }, env, { status: result.meta.changes ? 201 : 200 });
}

export async function syncVault(env: Env, vault: VaultRow, bodyText: string, requestId: string) {
  let body: { records?: EncryptedRecord[] };
  try {
    body = JSON.parse(bodyText) as typeof body;
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
  if (!Array.isArray(body.records)) throw new HttpError(400, 'Missing records array.');
  for (const record of body.records) assertRecord(record);

  const rows = body.records.map((record) => ({
    ...record,
    sizeBytes: encoder.encode(JSON.stringify(record)).length
  }));
  const now = new Date().toISOString();

  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO request_ids (vault_id, request_id, created_at) VALUES (?, ?, ?)')
        .bind(vault.vault_id, requestId, now),
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
