/**
 * Phase F Verification & Security Hardening Test Suite
 * Tests Out-of-Band Password Reset Delivery, Token Information Leak Prevention,
 * Forgot Password Rate Limiting, and 12-Character Password Length Policy.
 */

import assert from 'assert';
import { signJwt } from '../server/authUtils';

async function runPhaseFTests() {
  console.log('====================================================');
  console.log('   AGENTSGUARDIAN PHASE F HARDENING TEST SUITE     ');
  console.log('====================================================\n');

  const baseUrl = process.env.STAGING_URL || 'http://localhost:3000';
  console.log(`Target Gateway URL: ${baseUrl}\n`);

  // 1. TEST FORGOT PASSWORD RESPONSE BODY FOR REGISTERED USER (NO TOKEN LEAK)
  console.log('--- TEST 1: Forgot Password Token Information Leak Prevention ---');
  const registeredEmail = 'mritunjoysingh@gmail.com';

  const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: registeredEmail })
  });

  assert.strictEqual(forgotRes.status, 200, 'Forgot password returns HTTP 200');
  const forgotData = await forgotRes.json();

  assert.strictEqual(forgotData.success, true, 'Response contains success: true');
  assert.strictEqual(typeof forgotData.message, 'string', 'Response contains generic message');

  // CRITICAL SECURITY ASSERTIONS: No secrets in response body!
  assert.strictEqual(forgotData.resetToken, undefined, 'CRITICAL: resetToken MUST NOT be returned in response body');
  assert.strictEqual(forgotData.token, undefined, 'CRITICAL: token MUST NOT be returned in response body');
  assert.strictEqual(forgotData.expiresAt, undefined, 'CRITICAL: expiresAt MUST NOT be returned in response body');
  assert.strictEqual(forgotData.user, undefined, 'CRITICAL: user object MUST NOT be returned in response body');

  console.log('✔ Forgot password response returned generic message with ZERO leaked tokens or user metadata.');

  // 2. TEST UNIFORM RESPONSE FOR NON-EXISTENT EMAIL
  console.log('\n--- TEST 2: Uniform Response for Non-Existent Email ---');
  const nonExistentRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'unknown-random-user-999@domain.com' })
  });

  assert.strictEqual(nonExistentRes.status, 200, 'Forgot password for unknown email returns HTTP 200');
  const nonExistentData = await nonExistentRes.json();
  assert.strictEqual(nonExistentData.success, true, 'Non-existent email returns success: true');
  assert.strictEqual(nonExistentData.resetToken, undefined, 'Non-existent email response contains no resetToken');
  console.log('✔ Non-existent email request returns identical safe generic response structure.');

  // 3. TEST RATE LIMITING ON FORGOT PASSWORD
  console.log('\n--- TEST 3: Rate Limiting Throttling for Forgot Password Requests ---');
  const rateLimitEmail = 'rate-limit-target@domain.com';
  let rateLimited = false;

  for (let i = 0; i < 7; i++) {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: rateLimitEmail })
    });

    if (res.status === 429) {
      rateLimited = true;
      const data = await res.json();
      assert(data.error && data.error.includes('Too many'), 'HTTP 429 includes rate limit error message');
      console.log(`✔ Request #${i + 1} correctly throttled with HTTP 429 Too Many Requests.`);
      break;
    }
  }

  assert.strictEqual(rateLimited, true, 'Forgot password requests were rate limited after rapid calls');

  // 4. TEST MINIMUM PASSWORD LENGTH POLICY (12 CHARACTERS)
  console.log('\n--- TEST 4: Minimum Password Length Enforcement (12 Characters) ---');

  // Generate a valid password reset JWT
  const testResetToken = signJwt({
    userId: 'USR-000',
    email: registeredEmail,
    purpose: 'password_reset'
  }, 900);

  // Test 4a: Reject password shorter than 12 chars
  const shortPassRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: testResetToken,
      newPassword: 'short_pass' // 10 chars (< 12)
    })
  });

  assert.strictEqual(shortPassRes.status, 400, 'Reset password rejects password under 12 characters with HTTP 400');
  const shortPassData = await shortPassRes.json();
  assert(shortPassData.error && shortPassData.error.includes('12 characters'), 'Error specifies at least 12 characters requirement');
  console.log('✔ Reset password correctly rejected password under 12 characters.');

  // Test 4b: Accept password >= 12 chars
  const validPassRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: testResetToken,
      newPassword: 'StrongPassword12345!' // 20 chars (>= 12)
    })
  });

  assert.strictEqual(validPassRes.status, 200, 'Reset password succeeds with password >= 12 characters');
  const validPassData = await validPassRes.json();
  assert.strictEqual(validPassData.success, true, 'Password reset returned success: true');
  console.log('✔ Reset password successfully updated password with >= 12 character password.');

  console.log('\n====================================================');
  console.log('   ALL PHASE F SECURITY HARDENING TESTS PASSED!    ');
  console.log('====================================================');
}

runPhaseFTests().catch(err => {
  console.error('Phase F Test Failure:', err);
  process.exit(1);
});
