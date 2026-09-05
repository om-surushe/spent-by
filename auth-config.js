export function getAuthConfig(env) {
  const username = env.AUTH_USERNAME || '';
  const password = env.AUTH_PASSWORD || '';
  const sessionSecret = env.SESSION_SECRET || '';
  const enabled = Boolean(username && password && sessionSecret);

  if (env.NODE_ENV === 'production' && !enabled) {
    throw new Error('AUTH_USERNAME, AUTH_PASSWORD, and SESSION_SECRET are required in production');
  }

  return { username, password, sessionSecret, enabled };
}
