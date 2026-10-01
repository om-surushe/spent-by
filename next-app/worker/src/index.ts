import { authenticate } from './auth';
import { HttpError } from './errors';
import { corsHeaders, json, parseBody, text } from './http';
import { getVault, snapshot } from './store';
import { createVault, syncVault } from './vault-service';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const origin = request.headers.get('origin');
      if (origin && origin !== env.CORS_ORIGIN) throw new HttpError(403, 'Origin not allowed.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });

      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true, service: 'finance-vault', environment: env.ENVIRONMENT }, env);
      }

      const ip = request.headers.get('cf-connecting-ip') ?? 'local';
      if (env.IP_LIMITER && !(await env.IP_LIMITER.limit({ key: `ip:${ip}` })).success) {
        throw new HttpError(429, 'Too many requests.');
      }

      const bodyText = request.method === 'GET' ? '' : await parseBody(request, Number(env.MAX_REQUEST_BYTES));

      if (request.method === 'POST' && url.pathname === '/v1/vaults') {
        return createVault(request, env, bodyText);
      }

      const match = url.pathname.match(/^\/v1\/vaults\/([a-f0-9]{32})\/(snapshot|sync)$/);
      if (!match) throw new HttpError(404, 'Not found.');

      const [, vaultId, action] = match;
      if (env.VAULT_LIMITER && !(await env.VAULT_LIMITER.limit({ key: `vault:${vaultId}` })).success) {
        throw new HttpError(429, 'Too many requests.');
      }

      const vault = await getVault(env, vaultId);
      if (!vault) throw new HttpError(404, 'Vault not found.');

      const auth = await authenticate(request, vault, vaultId, bodyText);

      if (action === 'snapshot' && request.method === 'GET') return json(await snapshot(env, vault), env);
      if (action === 'sync' && request.method === 'POST') return json(await syncVault(env, vault, bodyText, auth.requestId), env);

      throw new HttpError(405, 'Method not allowed.');
    } catch (error) {
      if (error instanceof HttpError) return text(error.message, env, error.status);
      console.error(JSON.stringify({ event: 'worker_error', message: error instanceof Error ? error.message : 'unknown' }));
      return text('Internal server error.', env, 500);
    }
  }
} satisfies ExportedHandler<Env>;
