import { HttpError } from './errors';
import { encoder } from './http';
import type { VaultRow } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeBase64(value: string, urlSafe = false) {
  const normalized = urlSafe
    ? value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    : value;
  try {
    return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
  } catch {
    throw new HttpError(401, 'Invalid authentication.');
  }
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(value: Uint8Array) {
  const bytes = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

export function safeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

export async function authenticate(request: Request, vault: VaultRow | null, vaultId: string, bodyText: string) {
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
