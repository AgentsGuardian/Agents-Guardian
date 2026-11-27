import crypto from 'crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';

let kmsClient: KeyManagementServiceClient | null = null;
const publicKeyCache = new Map<string, string>();
let lastSignatureTime: string | null = null;

function getKmsClient(): KeyManagementServiceClient {
  if (!kmsClient) {
    kmsClient = new KeyManagementServiceClient();
  }
  return kmsClient;
}

export function getSigningKeyVersionName(overrideKey?: string): string {
  const raw = (overrideKey || process.env.KMS_SIGNING_KEY || '').trim();
  if (!raw) return '';
  if (raw.includes('/cryptoKeyVersions/')) {
    return raw;
  }
  return `${raw.replace(/\/+$/, '')}/cryptoKeyVersions/1`;
}

export function getSecretsKeyName(overrideKey?: string): string {
  return (overrideKey || process.env.KMS_SECRETS_KEY || '').trim();
}

export function isKmsSigningConfigured(): boolean {
  return Boolean(getSigningKeyVersionName());
}

export function isKmsSecretsConfigured(): boolean {
  return Boolean(getSecretsKeyName());
}

export function isKmsEnabled(): boolean {
  return isKmsSigningConfigured() || isKmsSecretsConfigured();
}

export function getLastSignatureTime(): string | null {
  return lastSignatureTime;
}

export function getKmsStatus() {
  const signingKey = (process.env.KMS_SIGNING_KEY || '').trim() || null;
  const secretsKey = (process.env.KMS_SECRETS_KEY || '').trim() || null;
  const enabled = Boolean(signingKey || secretsKey);
  return {
    enabled,
    kmsEnabled: enabled,
    signingEnabled: Boolean(signingKey),
    secretsEnabled: Boolean(secretsKey),
    keyName: signingKey || secretsKey || null,
    signingKeyName: signingKey,
    secretsKeyName: secretsKey,
    lastSignatureTime
  };
}

function normalizeSha256Digest(digestInput: Buffer | string): Buffer {
  if (Buffer.isBuffer(digestInput)) {
    if (digestInput.length === 32) {
      return digestInput;
    }
    return crypto.createHash('sha256').update(digestInput).digest();
  }
  const str = String(digestInput);
  if (/^[0-9a-fA-F]{64}$/.test(str)) {
    return Buffer.from(str, 'hex');
  }
  return crypto.createHash('sha256').update(str, 'utf8').digest();
}

// --- Pure BigInt NIST P-256 (secp256r1) ECDSA verification over a raw 32-byte SHA-256 digest ---
const P256_P = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
const P256_A = P256_P - 3n;
const P256_N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const P256_GX = BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296');
const P256_GY = BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5');

type Point = { x: bigint; y: bigint } | null;

function mod(a: bigint, m: bigint): bigint {
  const res = a % m;
  return res >= 0n ? res : res + m;
}

function modInverse(a: bigint, m: bigint): bigint {
  let t = 0n;
  let newT = 1n;
  let r = m;
  let newR = mod(a, m);
  while (newR !== 0n) {
    const q = r / newR;
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }
  if (r > 1n) throw new Error('Value is not invertible');
  return t < 0n ? t + m : t;
}

function pointAdd(p1: Point, p2: Point): Point {
  if (!p1) return p2;
  if (!p2) return p1;
  if (p1.x === p2.x && p1.y !== p2.y) return null;

  let lambda: bigint;
  if (p1.x === p2.x && p1.y === p2.y) {
    if (p1.y === 0n) return null;
    const num = mod(3n * p1.x * p1.x + P256_A, P256_P);
    const den = modInverse(mod(2n * p1.y, P256_P), P256_P);
    lambda = mod(num * den, P256_P);
  } else {
    const num = mod(p2.y - p1.y, P256_P);
    const den = modInverse(mod(p2.x - p1.x, P256_P), P256_P);
    lambda = mod(num * den, P256_P);
  }

  const x3 = mod(lambda * lambda - p1.x - p2.x, P256_P);
  const y3 = mod(lambda * (p1.x - x3) - p1.y, P256_P);
  return { x: x3, y: y3 };
}

function pointMultiply(k: bigint, p: Point): Point {
  let result: Point = null;
  let addend: Point = p;
  let scalar = k;
  while (scalar > 0n) {
    if (scalar & 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointAdd(addend, addend);
    scalar >>= 1n;
  }
  return result;
}

function parseEcdsaDerSignature(sigBuf: Buffer): { r: bigint; s: bigint } | null {
  try {
    if (sigBuf.length === 64 && sigBuf[0] !== 0x30) {
      const r = BigInt('0x' + sigBuf.subarray(0, 32).toString('hex'));
      const s = BigInt('0x' + sigBuf.subarray(32, 64).toString('hex'));
      return { r, s };
    }
    if (sigBuf[0] !== 0x30) return null;
    let offset = 2;
    if (sigBuf[1] & 0x80) {
      offset = 2 + (sigBuf[1] & 0x7f);
    }
    if (sigBuf[offset] !== 0x02) return null;
    const rLen = sigBuf[offset + 1];
    const rBytes = sigBuf.subarray(offset + 2, offset + 2 + rLen);
    offset += 2 + rLen;
    if (sigBuf[offset] !== 0x02) return null;
    const sLen = sigBuf[offset + 1];
    const sBytes = sigBuf.subarray(offset + 2, offset + 2 + sLen);
    const r = BigInt('0x' + rBytes.toString('hex'));
    const s = BigInt('0x' + sBytes.toString('hex'));
    return { r, s };
  } catch {
    return null;
  }
}

function verifyP256DigestWithPem(digest32: Buffer, sigBuf: Buffer, pem: string): boolean {
  try {
    const pubKeyObj = crypto.createPublicKey(pem);
    const jwk = pubKeyObj.export({ format: 'jwk' }) as { x?: string; y?: string };
    if (!jwk.x || !jwk.y) return false;

    const qx = BigInt('0x' + Buffer.from(jwk.x, 'base64url').toString('hex'));
    const qy = BigInt('0x' + Buffer.from(jwk.y, 'base64url').toString('hex'));
    const parsed = parseEcdsaDerSignature(sigBuf);
    if (!parsed) return false;
    const { r, s } = parsed;

    if (r <= 0n || r >= P256_N || s <= 0n || s >= P256_N) return false;

    const e = BigInt('0x' + digest32.toString('hex'));
    const w = modInverse(s, P256_N);
    const u1 = mod(e * w, P256_N);
    const u2 = mod(r * w, P256_N);

    const p1 = pointMultiply(u1, { x: P256_GX, y: P256_GY });
    const p2 = pointMultiply(u2, { x: qx, y: qy });
    const pt = pointAdd(p1, p2);
    if (!pt) return false;

    return mod(pt.x, P256_N) === r;
  } catch {
    return false;
  }
}

export interface KmsSignatureResult {
  signature: string;
  keyVersion: string;
  kms_signature: string;
  kms_key_version: string;
}

/**
 * Signs a SHA-256 digest using env KMS_SIGNING_KEY (asymmetricSign, EC P-256).
 * If KMS_SIGNING_KEY is missing or KMS fails, logs a warning and returns null without throwing.
 */
export async function signDigest(
  digestInput: Buffer | string
): Promise<KmsSignatureResult | null> {
  const keyVersionName = getSigningKeyVersionName();
  if (!keyVersionName) {
    console.warn('[KMS] KMS_SIGNING_KEY is not configured; skipping asymmetricSign.');
    return null;
  }

  try {
    const sha256Digest = normalizeSha256Digest(digestInput);
    const client = getKmsClient();
    const [signResponse] = await client.asymmetricSign({
      name: keyVersionName,
      digest: {
        sha256: sha256Digest
      }
    });

    if (!signResponse || !signResponse.signature) {
      console.warn('[KMS] asymmetricSign returned empty signature.');
      return null;
    }

    const sigBase64 = Buffer.from(signResponse.signature as Uint8Array).toString('base64');
    const resolvedVersion = signResponse.name || keyVersionName;
    lastSignatureTime = new Date().toISOString();

    return {
      signature: sigBase64,
      keyVersion: resolvedVersion,
      kms_signature: sigBase64,
      kms_key_version: resolvedVersion
    };
  } catch (err: any) {
    console.warn('[KMS] signDigest failed (skipping signature):', err?.message || err);
    return null;
  }
}

/**
 * Verifies a signature over a SHA-256 digest using the cached public key from KMS_SIGNING_KEY.
 */
export async function verifySignature(
  digestInput: Buffer | string,
  signatureBase64: string,
  keyVersionOverride?: string
): Promise<boolean> {
  const keyVersionName = getSigningKeyVersionName(keyVersionOverride);
  if (!keyVersionName) {
    console.warn('[KMS] KMS_SIGNING_KEY is not configured; skipping verifySignature.');
    return false;
  }

  try {
    const cleanSig = signatureBase64.startsWith('kms:')
      ? signatureBase64.slice(4)
      : signatureBase64;
    const sigBuf = Buffer.from(cleanSig, 'base64');
    const sha256Digest = normalizeSha256Digest(digestInput);

    let pem = publicKeyCache.get(keyVersionName);
    if (!pem) {
      const client = getKmsClient();
      const [pubKeyResponse] = await client.getPublicKey({ name: keyVersionName });
      if (!pubKeyResponse || !pubKeyResponse.pem) {
        console.warn('[KMS] getPublicKey returned empty PEM.');
        return false;
      }
      pem = pubKeyResponse.pem;
      publicKeyCache.set(keyVersionName, pem);
    }

    // Verify directly against the 32-byte SHA-256 digest (EC P-256)
    if (verifyP256DigestWithPem(sha256Digest, sigBuf, pem)) {
      return true;
    }

    // Fallback check via Node crypto.verify in case pre-image bytes were signed via standard verify stream
    const rawBuf = Buffer.isBuffer(digestInput) ? digestInput : Buffer.from(String(digestInput), 'utf8');
    return crypto.verify('sha256', rawBuf, pem, sigBuf);
  } catch (err: any) {
    console.warn('[KMS] verifySignature failed:', err?.message || err);
    return false;
  }
}

/**
 * Encrypts a secret string using env KMS_SECRETS_KEY and prefixes the result with "kms:".
 * If KMS_SECRETS_KEY is missing or KMS fails, logs a warning and returns the original value.
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith('kms:')) return plaintext;

  const keyName = getSecretsKeyName();
  if (!keyName) {
    console.warn('[KMS] KMS_SECRETS_KEY is not configured; skipping KMS secret encryption.');
    return plaintext;
  }

  try {
    const client = getKmsClient();
    const [encryptResponse] = await client.encrypt({
      name: keyName,
      plaintext: Buffer.from(plaintext, 'utf8')
    });

    if (!encryptResponse || !encryptResponse.ciphertext) {
      console.warn('[KMS] encrypt returned empty ciphertext; keeping plain value.');
      return plaintext;
    }

    const base64Cipher = Buffer.from(encryptResponse.ciphertext as Uint8Array).toString('base64');
    return `kms:${base64Cipher}`;
  } catch (err: any) {
    console.warn('[KMS] encryptSecret failed (falling back without crashing):', err?.message || err);
    return plaintext;
  }
}

/**
 * Decrypts a secret prefixed with "kms:" using env KMS_SECRETS_KEY.
 * Plain values not starting with "kms:" are returned as-is so existing stored values never break.
 */
export async function decryptSecret(storedValue: string): Promise<string> {
  if (!storedValue || typeof storedValue !== 'string') return storedValue;
  if (!storedValue.startsWith('kms:')) {
    return storedValue;
  }

  const keyName = getSecretsKeyName();
  if (!keyName) {
    console.warn('[KMS] KMS_SECRETS_KEY is not configured; cannot decrypt kms: secret.');
    return storedValue;
  }

  try {
    const base64Cipher = storedValue.slice(4);
    const ciphertext = Buffer.from(base64Cipher, 'base64');
    const client = getKmsClient();
    const [decryptResponse] = await client.decrypt({
      name: keyName,
      ciphertext
    });

    if (!decryptResponse || !decryptResponse.plaintext) {
      console.warn('[KMS] decrypt returned empty plaintext.');
      return storedValue;
    }

    return Buffer.from(decryptResponse.plaintext as Uint8Array).toString('utf8');
  } catch (err: any) {
    console.warn('[KMS] decryptSecret failed (returning stored value without crashing):', err?.message || err);
    return storedValue;
  }
}
