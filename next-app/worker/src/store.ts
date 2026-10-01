import type { RecordRow, VaultRow } from './types';

export async function getVault(env: Env, vaultId: string) {
  return env.DB.prepare('SELECT vault_id, auth_hash, created_at, updated_at, storage_bytes FROM vaults WHERE vault_id = ?')
    .bind(vaultId)
    .first<VaultRow>();
}

export async function snapshot(env: Env, vault: VaultRow) {
  const { results } = await env.DB.prepare(
    'SELECT id, created_at, updated_at, deleted_at, device_id, iv, encrypted_data, size_bytes FROM records WHERE vault_id = ? ORDER BY updated_at DESC'
  ).bind(vault.vault_id).all<RecordRow>();

  return {
    manifest: {
      vaultId: vault.vault_id,
      authHash: vault.auth_hash,
      createdAt: vault.created_at,
      updatedAt: vault.updated_at,
      storageBytes: vault.storage_bytes,
      recentRequestIds: [],
      records: results.map((row) => ({
        id: row.id,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
        deviceId: row.device_id,
        sizeBytes: row.size_bytes
      }))
    },
    records: results.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      deviceId: row.device_id,
      iv: row.iv,
      encryptedData: row.encrypted_data
    }))
  };
}
