import Dexie, { type Table } from 'dexie';
import type { EncryptedRecord, VaultMeta } from '../types';

export type MetaRow = {
  key: string;
  value: unknown;
};

class VaultDb extends Dexie {
  records!: Table<EncryptedRecord, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('finance-vault-preview');
    this.version(1).stores({
      records: 'id, updatedAt, deletedAt',
      meta: 'key'
    });
  }
}

export const db = new VaultDb();

export async function getVaultMeta() {
  return (await db.meta.get('vaultMeta'))?.value as VaultMeta | undefined;
}

export async function setVaultMeta(meta: VaultMeta) {
  await db.meta.put({ key: 'vaultMeta', value: meta });
}

export async function getWorkerUrl() {
  return (await db.meta.get('workerUrl'))?.value as string | undefined;
}

export async function setWorkerUrl(workerUrl: string) {
  await db.meta.put({ key: 'workerUrl', value: workerUrl });
}

export async function clearVaultData() {
  const workerUrl = await getWorkerUrl();
  await db.transaction('rw', db.records, db.meta, async () => {
    await db.records.clear();
    await db.meta.clear();
    if (workerUrl) {
      await db.meta.put({ key: 'workerUrl', value: workerUrl });
    }
  });
}

export async function listEncryptedRecords() {
  return db.records.orderBy('updatedAt').reverse().toArray();
}

export async function upsertEncryptedRecord(record: EncryptedRecord) {
  await db.records.put(record);
}

export async function upsertEncryptedRecords(records: EncryptedRecord[]) {
  await db.transaction('rw', db.records, () => db.records.bulkPut(records));
}
