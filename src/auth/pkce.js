function encodeBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generateCodeVerifier() {
  return encodeBase64Url(randomBytes(32));
}

export async function generateCodeChallenge(codeVerifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return encodeBase64Url(new Uint8Array(digest));
}

export function generateState() {
  return encodeBase64Url(randomBytes(16));
}

export function generateNonce() {
  return encodeBase64Url(randomBytes(16));
}
