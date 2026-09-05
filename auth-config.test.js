import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthConfig } from './auth-config.js';

test('allows unauthenticated local development', () => {
  assert.deepEqual(getAuthConfig({ NODE_ENV: 'development' }), {
    username: '',
    password: '',
    sessionSecret: '',
    enabled: false
  });
});

test('requires complete authentication in production', () => {
  assert.throws(
    () => getAuthConfig({ NODE_ENV: 'production', AUTH_USERNAME: 'admin' }),
    /required in production/
  );
});

test('enables complete authentication configuration', () => {
  assert.equal(getAuthConfig({
    NODE_ENV: 'production',
    AUTH_USERNAME: 'admin',
    AUTH_PASSWORD: 'secret',
    SESSION_SECRET: 'long-random-value'
  }).enabled, true);
});
