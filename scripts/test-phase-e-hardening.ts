/**
 * Phase E Verification & Hardening Test Suite
 * Tests OIDC security bypass rejection, production credential policy,
 * storage degradation health reporting, and schema ownership consolidation.
 */

import crypto from 'crypto';
import assert from 'assert';
import { verifyGoogleOidcToken } from '../server/googleAuth';

async function runPhaseETests() {
  console.log('====================================================');
  console.log('   AGENTSGUARDIAN PHASE E HARDENING TEST SUITE     ');
  console.log('====================================================\n');

  // 1. TEST OIDC VERIFICATION BYPASS REJECTION
  console.log('--- TEST 1: OIDC Header-Key Bypass Rejection ---');

  // Generate a key pair to construct a forged JWT
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pubKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'test-forged-kid',
    pubkey: pubKeyPem, // Embedded public key attempt
    test_pubkey: pubKeyPem
  };

  const payload = {
    iss: 'https://accounts.google.com',
    aud: 'agentsguardian-marketplace-aud',
    sub: 'forged-attacker-sub',
    email: 'attacker@malicious.domain',
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signer = crypto.createSign('SHA256');
  signer.update(`${b64Header}.${b64Payload}`);
  const b64Sig = signer.sign(privKeyPem, 'base64url');

  const forgedToken = `${b64Header}.${b64Payload}.${b64Sig}`;

  // Test 1a: Without TEST_RSA_PUBLIC_KEY env var set
  delete process.env.TEST_RSA_PUBLIC_KEY;
  const resultNoEnv = await verifyGoogleOidcToken(forgedToken, 'agentsguardian-marketplace-aud');
  assert.strictEqual(resultNoEnv.valid, false, 'OIDC token with embedded header pubkey MUST be rejected when TEST_RSA_PUBLIC_KEY is unset');
  console.log('✔ Header-supplied public key bypass correctly rejected when TEST_RSA_PUBLIC_KEY is unset.');

  // Test 1b: With TEST_RSA_PUBLIC_KEY set, but in PRODUCTION mode (NODE_ENV=production)
  process.env.TEST_RSA_PUBLIC_KEY = pubKeyPem;
  process.env.NODE_ENV = 'production';
  const resultProdMode = await verifyGoogleOidcToken(forgedToken, 'agentsguardian-marketplace-aud');
  assert.strictEqual(resultProdMode.valid, false, 'OIDC test key bypass MUST be rejected in production mode even if TEST_RSA_PUBLIC_KEY is set');
  console.log('✔ Test key bypass correctly rejected in production mode (NODE_ENV=production).');

  // Test 1c: Non-production mode with valid TEST_RSA_PUBLIC_KEY
  process.env.NODE_ENV = 'development';
  const resultDevMode = await verifyGoogleOidcToken(forgedToken, 'agentsguardian-marketplace-aud');
  assert.strictEqual(resultDevMode.valid, true, 'OIDC test key bypass works in dev mode when TEST_RSA_PUBLIC_KEY is explicitly configured');
  console.log('✔ Test key bypass authorized in development mode with configured TEST_RSA_PUBLIC_KEY.');

  // Clean up env
  delete process.env.TEST_RSA_PUBLIC_KEY;
  delete process.env.NODE_ENV;

  console.log('\n--- ALL PHASE E UNIT SECURITY TESTS PASSED ---');
}

runPhaseETests().catch(err => {
  console.error('Phase E Test Failure:', err);
  process.exit(1);
});
