import crypto from 'crypto';

interface GoogleJwksKey {
  kty: string;
  alg: string;
  use: string;
  kid: string;
  n: string;
  e: string;
}

let jwksCache: { keys: GoogleJwksKey[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getGoogleJwks(): Promise<GoogleJwksKey[]> {
  const now = Date.now();
  if (jwksCache && (now - jwksCache.fetchedAt) < CACHE_TTL_MS) {
    return jwksCache.keys;
  }

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (res.ok) {
      const data = await res.json() as { keys: GoogleJwksKey[] };
      if (Array.isArray(data.keys)) {
        jwksCache = { keys: data.keys, fetchedAt: now };
        return data.keys;
      }
    }
  } catch (err) {
    console.warn('[GoogleAuth] Failed to fetch Google JWKS:', err);
  }

  return jwksCache ? jwksCache.keys : [];
}

export interface VerifyJwtResult {
  valid: boolean;
  claims?: any;
  error?: string;
}

export async function verifyGoogleOidcToken(
  authHeaderOrToken: string | undefined,
  expectedAudience?: string
): Promise<VerifyJwtResult> {
  if (!authHeaderOrToken) {
    return { valid: false, error: 'Missing token or Authorization header' };
  }

  let token = authHeaderOrToken.trim();
  if (token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT structure' };
  }

  const [headerB64, payloadB64, sigB64] = parts;

  let header: any;
  let payload: any;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'Failed to parse JWT JSON header or payload' };
  }

  // 1. Verify Issuer
  const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
  if (!payload.iss || !validIssuers.includes(payload.iss)) {
    return { valid: false, error: `Invalid issuer: ${payload.iss}` };
  }

  // 2. Verify Expiration
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < (nowSec - 60)) {
    return { valid: false, error: 'Token has expired' };
  }

  // 3. Verify Audience if specified
  if (expectedAudience && payload.aud) {
    const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audList.some((a: string) => a === expectedAudience || a.includes(expectedAudience))) {
      return { valid: false, error: `Audience mismatch: expected ${expectedAudience}, got ${payload.aud}` };
    }
  }

  // 4. Verify Signature via JWKS or Test Key
  const kid = header.kid;
  if (!kid) {
    return { valid: false, error: 'Missing kid in JWT header' };
  }

  // Check test key bypass ONLY if TEST_RSA_PUBLIC_KEY env var is explicitly configured by deployer AND env is non-production
  const isProduction = process.env.NODE_ENV === 'production' || process.env.ENV === 'production';
  const testPubKey = process.env.TEST_RSA_PUBLIC_KEY;
  if (!isProduction && testPubKey && header.alg === 'RS256' && (kid === 'test-key-id' || kid.startsWith('test-'))) {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(`${headerB64}.${payloadB64}`);
      const isSigValid = verify.verify(testPubKey, Buffer.from(sigB64, 'base64url'));
      if (isSigValid) {
        return { valid: true, claims: payload };
      } else {
        return { valid: false, error: 'Invalid test signature' };
      }
    } catch (e: any) {
      return { valid: false, error: `Test signature verification failed: ${e.message}` };
    }
  }

  const jwks = await getGoogleJwks();
  const key = jwks.find(k => k.kid === kid);
  if (!key) {
    return { valid: false, error: `Key ID '${kid}' not found in Google JWKS` };
  }

  try {
    const publicKey = crypto.createPublicKey({ key: key as any, format: 'jwk' });
    const verify = crypto.createVerify('SHA256');
    verify.update(`${headerB64}.${payloadB64}`);
    const isSigValid = verify.verify(publicKey, Buffer.from(sigB64, 'base64url'));

    if (!isSigValid) {
      return { valid: false, error: 'Google JWT signature verification failed' };
    }

    return { valid: true, claims: payload };
  } catch (err: any) {
    return { valid: false, error: `Cryptographic verification error: ${err.message}` };
  }
}
