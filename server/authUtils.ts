import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'ag_jwt_secret_sovereign_key_2026';

export interface PasswordHashResult {
  hash: string;
  salt: string;
}

export function hashPassword(password: string, salt?: string): PasswordHashResult {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  if (!password || !storedHash || !storedSalt) return false;
  try {
    const hash = crypto.scryptSync(password, storedSalt, 64).toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (hashBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, storedBuf);
  } catch {
    return false;
  }
}

export function signJwt(payload: Record<string, any>, expiresInSeconds: number = 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  const fullPayload = { ...payload, iat: now, exp };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const dataToSign = `${b64Header}.${b64Payload}`;

  const signature = crypto.createHmac('sha256', JWT_SECRET).update(dataToSign).digest('base64url');
  return `${dataToSign}.${signature}`;
}

export function verifyJwt(token: string): { valid: boolean; payload?: any; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing' };
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token format' };
  }

  const [b64Header, b64Payload, signature] = parts;
  const dataToSign = `${b64Header}.${b64Payload}`;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(dataToSign).digest('base64url');

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Session token expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: 'Failed to verify token' };
  }
}

export function generateTenantApiKey(): { rawKey: string; keyHash: string } {
  const rawKey = `ag_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = hashTenantApiKey(rawKey);
  return { rawKey, keyHash };
}

export function hashTenantApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}
