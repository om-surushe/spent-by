import { WORDS } from './wordlist';
import type { EncryptedRecord, TransactionData, TransactionRecord, VaultMeta } from '../types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SALT = encoder.encode('finance-vault-v1');

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

export function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function deriveBits(phrase: string, info: string, length: number) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(phrase), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: encoder.encode(info) }, material, length);
  return new Uint8Array(bits);
}

async function deriveAesKey(phrase: string) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(phrase), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: encoder.encode('encryption-key') },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function normalizePhrase(phrase: string) {
  return phrase.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

export function generateRecoveryPhrase() {
  const bytes = crypto.getRandomValues(new Uint16Array(24));
  return Array.from(bytes, (value) => WORDS[value % WORDS.length]).join(' ');
}

export async function deriveVault(phrase: string) {
  const normalizedPhrase = normalizePhrase(phrase);
  const [vaultIdBytes, authTokenBytes, encryptionKey] = await Promise.all([
    deriveBits(normalizedPhrase, 'vault-id', 128),
    deriveBits(normalizedPhrase, 'auth-token', 256),
    deriveAesKey(normalizedPhrase)
  ]);

  return {
    normalizedPhrase,
    vaultId: toHex(vaultIdBytes),
    authToken: toBase64(authTokenBytes),
    authHash: await sha256Base64Url(authTokenBytes),
    authTokenBytes,
    encryptionKey
  };
}

export async function sha256Base64Url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', asBufferSource(bytes));
  return toBase64Url(new Uint8Array(digest));
}

export async function hmacBase64Url(secret: Uint8Array, payload: string) {
  const key = await crypto.subtle.importKey('raw', asBufferSource(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

export function toBase64Url(bytes: Uint8Array) {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return fromBase64(padded);
}

export async function encryptTransaction(record: TransactionRecord, encryptionKey: CryptoKey): Promise<EncryptedRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(record.data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, plaintext);

  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    deviceId: record.deviceId,
    iv: toBase64(iv),
    encryptedData: toBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptTransaction(record: EncryptedRecord, encryptionKey: CryptoKey): Promise<TransactionRecord> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(record.iv) },
    encryptionKey,
    fromBase64(record.encryptedData)
  );

  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    deviceId: record.deviceId,
    data: JSON.parse(decoder.decode(plaintext)) as TransactionData
  };
}

export function createVaultMeta(vaultId: string): VaultMeta {
  return {
    vaultId,
    deviceId: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
}
