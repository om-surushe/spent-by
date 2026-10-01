import { HttpError } from './errors';

export const encoder = new TextEncoder();

export function corsHeaders(env: Env, headers?: HeadersInit) {
  return {
    'access-control-allow-origin': env.CORS_ORIGIN,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-auth-hash,x-device-id,x-vault-id,x-request-id,x-timestamp,x-signature',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...(headers ?? {})
  };
}

export function json(data: unknown, env: Env, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: corsHeaders(env, init.headers) });
}

export function text(message: string, env: Env, status: number) {
  return new Response(message, { status, headers: corsHeaders(env) });
}

export async function parseBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) {
    throw new HttpError(413, 'Request too large.');
  }
  const bodyText = await request.text();
  if (encoder.encode(bodyText).length > maxBytes) throw new HttpError(413, 'Request too large.');
  return bodyText;
}
