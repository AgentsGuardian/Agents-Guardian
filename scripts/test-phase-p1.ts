/**
 * Phase P Part 1 Integration & Regression Test Suite
 * Validates:
 * 1. Absence of hardcoded auto-login credentials and SuperAdmin fallbacks.
 * 2. Unauthenticated state handling (clean 401 handling without silent hijacking).
 * 3. Role-based RBAC evaluation on SuperAdmin endpoints without email hardcoding.
 * 4. Proper login and registration flows.
 */

import 'dotenv/config';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { signJwt } from '../server/authUtils';

async function runPhaseP1Tests() {
  console.log('====================================================');
  console.log('   AGENTSGUARDIAN PHASE P-1 REGRESSION TEST SUITE    ');
  console.log('====================================================\n');

  const baseUrl = process.env.STAGING_URL || 'http://localhost:3000';
  console.log(`Target Gateway URL: ${baseUrl}\n`);

  // 1. STATIC CODE AUDIT: Ensure no hardcoded auto-login or email bypasses in frontend
  console.log('--- TEST 1: Static Codebase Audit for Hardcoded Identity & Auto-Login ---');
  const storeContent = fs.readFileSync(path.join(process.cwd(), 'src/store/useGovernanceStore.ts'), 'utf8');
  assert.ok(
    !storeContent.includes('mritunjoysingh@gmail.com'),
    'FAIL: useGovernanceStore.ts still contains hardcoded email mritunjoysingh@gmail.com'
  );
  assert.ok(
    !storeContent.includes("admin123"),
    'FAIL: useGovernanceStore.ts still contains hardcoded auto-login password'
  );
  assert.ok(
    !storeContent.includes("POST',") || !storeContent.includes('/api/auth/login'),
    'FAIL: useGovernanceStore.ts should not contain background auto-login fetch calls'
  );

  const adminPillarContent = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminPillar.tsx'), 'utf8');
  assert.ok(
    !adminPillarContent.includes('mritunjoysingh@gmail.com'),
    'FAIL: AdminPillar.tsx still contains hardcoded email checks'
  );

  const overviewContent = fs.readFileSync(path.join(process.cwd(), 'src/components/Overview.tsx'), 'utf8');
  assert.ok(
    !overviewContent.includes('mritunjoysingh@gmail.com'),
    'FAIL: Overview.tsx still contains hardcoded email checks'
  );

  const helpCenterContent = fs.readFileSync(path.join(process.cwd(), 'src/components/HelpCenter.tsx'), 'utf8');
  assert.ok(
    !helpCenterContent.includes('mritunjoysingh@gmail.com'),
    'FAIL: HelpCenter.tsx still contains hardcoded email checks'
  );
  console.log('✅ Static codebase audit passed: 0 hardcoded auto-login or email-based bypasses found in UI components.\n');

  // 2. UNAUTHENTICATED STATE TEST: /api/state returns 401 when no token is passed
  console.log('--- TEST 2: Unauthenticated State Enforcement ---');
  const unauthRes = await fetch(`${baseUrl}/api/state`, {
    headers: { 'Content-Type': 'application/json' }
  });
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request to /api/state must return 401');
  console.log('✅ Unauthenticated requests are strictly rejected with 401 without silent bypass.\n');

  // 3. REAL REGISTRATION AND AUTHENTICATION
  console.log('--- TEST 3: Real User Registration & Login ---');
  const testEmail = `operator_${Date.now()}@guardian.gov`;
  const testPassword = 'StrongPassword12345!';

  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Operations Lead',
      email: testEmail,
      password: testPassword,
      role: 'Operator'
    })
  });
  assert.ok(regRes.ok, `Registration failed with HTTP ${regRes.status}`);
  const regData = await regRes.json();
  assert.ok(regData.token, 'Registration must return a valid session token');
  console.log(`✅ Registered new user with token: ${regData.token.substring(0, 15)}...`);

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword
    })
  });
  assert.ok(loginRes.ok, `Login failed with HTTP ${loginRes.status}`);
  const loginData = await loginRes.json();
  assert.ok(loginData.token, 'Login must return a valid session token');
  console.log(`✅ Logged in successfully as registered user.\n`);

  // 4. AUTHENTICATED STATE ACCESS WITH VALID TOKEN
  console.log('--- TEST 4: Authenticated /api/state Access ---');
  const authStateRes = await fetch(`${baseUrl}/api/state`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`
    }
  });
  assert.ok(authStateRes.ok, `/api/state failed with HTTP ${authStateRes.status}`);
  const stateData = await authStateRes.json();
  assert.ok(Array.isArray(stateData.policies), 'State must return policies array');
  assert.ok(Array.isArray(stateData.users), 'State must return users array');
  console.log(`✅ Authenticated state retrieved successfully with ${stateData.users.length} users.\n`);

  // 5. SUPERADMIN ROLE-BASED ADMIN ACTION
  console.log('--- TEST 5: Role-Based Access Control on Admin Endpoints ---');
  // Generate a valid SuperAdmin token
  const superAdminJwt = signJwt({
    userId: 'USR-000',
    email: 'admin@guardian.gov',
    role: 'SuperAdmin'
  }, 3600);

  const resetRes = await fetch(`${baseUrl}/api/admin/users/USR-001/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminJwt}`
    }
  });
  assert.ok(
    resetRes.ok,
    `Admin password reset endpoint failed for SuperAdmin role with HTTP ${resetRes.status}`
  );
  const resetData = await resetRes.json();
  assert.strictEqual(resetData.success, true, 'Password reset action must succeed for SuperAdmin');
  console.log('✅ SuperAdmin role granted authorized execution on admin endpoint.\n');

  console.log('====================================================');
  console.log('   ALL PHASE P-1 TESTS PASSED SUCCESSFULLY!         ');
  console.log('====================================================');
}

runPhaseP1Tests().catch((err) => {
  console.error('❌ PHASE P-1 TEST SUITE FAILED:', err);
  process.exit(1);
});
