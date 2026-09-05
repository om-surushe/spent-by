PRAGMA foreign_keys = ON;

CREATE TABLE vaults (
  vault_id TEXT PRIMARY KEY,
  auth_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  storage_bytes INTEGER NOT NULL DEFAULT 0,
  max_bytes INTEGER NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'owner'))
);

CREATE TABLE app_limits (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  max_vaults INTEGER NOT NULL
);

INSERT INTO app_limits (id, max_vaults) VALUES (1, 200);

CREATE TABLE quota_guard (
  value INTEGER NOT NULL CHECK (value = 0)
);

CREATE TABLE records (
  vault_id TEXT NOT NULL,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL,
  iv TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  PRIMARY KEY (vault_id, id),
  FOREIGN KEY (vault_id) REFERENCES vaults(vault_id) ON DELETE CASCADE
);

CREATE INDEX records_vault_updated ON records(vault_id, updated_at DESC);

CREATE TABLE request_ids (
  vault_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (vault_id, request_id),
  FOREIGN KEY (vault_id) REFERENCES vaults(vault_id) ON DELETE CASCADE
);

CREATE INDEX request_ids_created ON request_ids(vault_id, created_at DESC);
