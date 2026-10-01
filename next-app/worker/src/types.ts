export type EncryptedRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
  iv: string;
  encryptedData: string;
};

export type VaultRow = {
  vault_id: string;
  auth_hash: string;
  created_at: string;
  updated_at: string;
  storage_bytes: number;
};

export type RecordRow = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
  iv: string;
  encrypted_data: string;
  size_bytes: number;
};
