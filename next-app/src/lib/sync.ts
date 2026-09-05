import { fromBase64, hmacBase64Url } from './crypto';
import type { EncryptedRecord, SyncSnapshot } from '../types';

type RequestOptions = {
  workerUrl: string;
  path: string;
  method?: 'GET' | 'POST';
  authToken: string;
  authHash: string;
  deviceId: string;
  vaultId: string;
  body?: unknown;
};

function trimUrl(url: string) {
  return url.replace(/\/$/, '');
}

async function signedRequest<T>({ workerUrl, path, method = 'GET', authToken, authHash, deviceId, vaultId, body }: RequestOptions): Promise<T> {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const bodyText = body ? JSON.stringify(body) : '';
  const signaturePayload = [method, path, timestamp, requestId, bodyText].join('\n');
  const signature = await hmacBase64Url(fromBase64(authToken), signaturePayload);

  const response = await fetch(`${trimUrl(workerUrl)}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${authToken}`,
      'x-auth-hash': authHash,
      'x-device-id': deviceId,
      'x-vault-id': vaultId,
      'x-request-id': requestId,
      'x-timestamp': timestamp,
      'x-signature': signature
    },
    body: bodyText || undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Sync failed (${response.status})`);
  }

  return response.status === 204 ? (undefined as T) : (await response.json() as T);
}

export async function createRemoteVault(args: { workerUrl: string; authToken: string; authHash: string; deviceId: string; vaultId: string; turnstileToken?: string; }) {
  return signedRequest<{ ok: true }>({
    workerUrl: args.workerUrl,
    path: '/v1/vaults',
    method: 'POST',
    authToken: args.authToken,
    authHash: args.authHash,
    deviceId: args.deviceId,
    vaultId: args.vaultId,
    body: {
      vaultId: args.vaultId,
      authHash: args.authHash,
      deviceId: args.deviceId,
      turnstileToken: args.turnstileToken
    }
  });
}

export async function pushRemoteVault(args: { workerUrl: string; authToken: string; authHash: string; deviceId: string; vaultId: string; records: EncryptedRecord[]; }) {
  return signedRequest<SyncSnapshot>({
    workerUrl: args.workerUrl,
    path: `/v1/vaults/${args.vaultId}/sync`,
    method: 'POST',
    authToken: args.authToken,
    authHash: args.authHash,
    deviceId: args.deviceId,
    vaultId: args.vaultId,
    body: { records: args.records }
  });
}

export async function pullRemoteVault(args: { workerUrl: string; authToken: string; authHash: string; deviceId: string; vaultId: string; }) {
  return signedRequest<SyncSnapshot>({
    workerUrl: args.workerUrl,
    path: `/v1/vaults/${args.vaultId}/snapshot`,
    method: 'GET',
    authToken: args.authToken,
    authHash: args.authHash,
    deviceId: args.deviceId,
    vaultId: args.vaultId
  });
}
