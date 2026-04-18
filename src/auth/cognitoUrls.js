function toBaseUrl(domain) {
  const normalizedDomain = String(domain ?? '').trim();
  const withProtocol = /^https?:\/\//i.test(normalizedDomain)
    ? normalizedDomain
    : `https://${normalizedDomain}`;

  return withProtocol.replace(/\/+$/, '');
}

export function buildAuthorizeUrl({ domain, clientId, redirectUri, codeChallenge, state, nonce }) {
  const url = new URL('/oauth2/authorize', toBaseUrl(domain));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  return url.toString();
}

export function buildTokenUrl(domain) {
  return new URL('/oauth2/token', toBaseUrl(domain)).toString();
}

export function buildLogoutUrl({ domain, clientId, logoutUri }) {
  const url = new URL('/logout', toBaseUrl(domain));
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('logout_uri', logoutUri);
  return url.toString();
}
