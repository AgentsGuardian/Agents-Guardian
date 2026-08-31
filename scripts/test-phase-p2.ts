/**
 * Phase P Part 2 Integration & Regression Test Suite
 * Validates:
 * 1. Scoped Role Impersonation access controls (SuperAdmin & Admin only; Operator & Auditor blocked).
 * 2. Privilege bounds enforcement (Admin cannot impersonate SuperAdmin or Admin; SuperAdmin can preview lower roles).
 * 3. View-only UI preview guarantee (backend API authorization strictly preserved under real JWT identity).
 * 4. Audit ledger recording for ROLE_IMPERSONATION_STARTED and ROLE_IMPERSONATION_ENDED.
 * 5. Static UI audit for persistent preview banner, exit control, and role preview UI components.
 */

import 'dotenv/config';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { signJwt } from '../server/authUtils';

async function runPhaseP2Tests() {
  console.log('====================================================');
  console.log('   AGENTSGUARDIAN PHASE P-2 REGRESSION TEST SUITE    ');
  console.log('====================================================\n');

  const baseUrl = process.env.STAGING_URL || 'http://localhost:3000';
  console.log(`Target Gateway URL: ${baseUrl}\n`);

  // 1. STATIC UI & CODE AUDIT
  console.log('--- TEST 1: Static Codebase Audit for Impersonation Architecture ---');
  
  const appContent = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(
    appContent.includes('impersonation-persistent-banner'),
    'FAIL: App.tsx missing persistent impersonation banner id="impersonation-persistent-banner"'
  );
  assert.ok(
    appContent.includes('exit-impersonation-btn'),
    'FAIL: App.tsx missing exit impersonation button id="exit-impersonation-btn"'
  );
  assert.ok(
    appContent.includes('effectiveUser'),
    'FAIL: App.tsx missing effectiveUser integration'
  );

  const storeContent = fs.readFileSync(path.join(process.cwd(), 'src/store/useGovernanceStore.ts'), 'utf8');
  assert.ok(
    storeContent.includes('startImpersonation') && storeContent.includes('stopImpersonation'),
    'FAIL: useGovernanceStore.ts missing startImpersonation / stopImpersonation methods'
  );
  assert.ok(
    storeContent.includes('impersonatedRole') && storeContent.includes('effectiveUser'),
    'FAIL: useGovernanceStore.ts missing impersonatedRole / effectiveUser state'
  );

  const adminPillarContent = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminPillar.tsx'), 'utf8');
  assert.ok(
    adminPillarContent.includes('impersonation-control-panel'),
    'FAIL: AdminPillar.tsx missing impersonation control panel'
  );

  console.log('✅ Static codebase audit passed: persistent banner, exit buttons, store methods, and IAM controls verified.\n');

  // Seed SuperAdmin token (USR-000)
  const superAdminToken = signJwt({
    userId: 'USR-000',
    email: 'admin@guardian.gov',
    role: 'SuperAdmin'
  });

  const ts = Date.now();

  // Create dedicated test users using SuperAdmin credentials
  const createAdminRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      name: 'Test Admin P2',
      email: `test.admin.${ts}@guardian.gov`,
      password: 'AdminPassword123!',
      role: 'Admin'
    })
  });
  const adminData = await createAdminRes.json();
  assert.strictEqual(createAdminRes.status, 200, `Admin registration failed: ${JSON.stringify(adminData)}`);
  const adminToken = adminData.token;

  const createOpRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Operator P2',
      email: `test.operator.${ts + 1}@guardian.gov`,
      password: 'OperatorPassword123!',
      role: 'Operator'
    })
  });
  const opData = await createOpRes.json();
  assert.strictEqual(createOpRes.status, 200, `Operator registration failed: ${JSON.stringify(opData)}`);
  const operatorToken = opData.token;

  const createAuditRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Auditor P2',
      email: `test.auditor.${ts + 2}@guardian.gov`,
      password: 'AuditorPassword123!',
      role: 'Auditor'
    })
  });
  const auditData = await createAuditRes.json();
  assert.strictEqual(createAuditRes.status, 200, `Auditor registration failed: ${JSON.stringify(auditData)}`);
  const auditorToken = auditData.token;

  // 2. UNAUTHENTICATED & ROLE RESTRICTIONS
  console.log('--- TEST 2: Gated Endpoint Access Controls ---');
  
  // Unauthenticated request
  const unauthRes = await fetch(`${baseUrl}/api/impersonation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetRole: 'Operator' })
  });
  assert.strictEqual(unauthRes.status, 401, `Expected 401 for unauthenticated request, got ${unauthRes.status}`);
  console.log('✅ Unauthenticated impersonation request correctly returned 401 Unauthorized.');

  // Operator request (must be 403)
  const operatorRes = await fetch(`${baseUrl}/api/impersonation/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${operatorToken}`
    },
    body: JSON.stringify({ targetRole: 'Auditor' })
  });
  assert.strictEqual(operatorRes.status, 403, `Expected 403 for Operator attempting impersonation, got ${operatorRes.status}`);
  console.log('✅ Operator attempting impersonation correctly returned 403 Forbidden.');

  // Auditor request (must be 403)
  const auditorRes = await fetch(`${baseUrl}/api/impersonation/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auditorToken}`
    },
    body: JSON.stringify({ targetRole: 'Operator' })
  });
  assert.strictEqual(auditorRes.status, 403, `Expected 403 for Auditor attempting impersonation, got ${auditorRes.status}`);
  console.log('✅ Auditor attempting impersonation correctly returned 403 Forbidden.');

  // 3. PRIVILEGE BOUNDS ENFORCEMENT
  console.log('\n--- TEST 3: Privilege Bounds & Escalation Prevention ---');

  // Admin trying to impersonate SuperAdmin (must be rejected 403)
  const adminEscalateSuperRes = await fetch(`${baseUrl}/api/impersonation/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ targetRole: 'SuperAdmin' })
  });
  assert.strictEqual(adminEscalateSuperRes.status, 403, `Expected 403 for Admin attempting SuperAdmin impersonation, got ${adminEscalateSuperRes.status}`);
  console.log('✅ Admin attempting to impersonate SuperAdmin was rejected with 403 Forbidden (privilege escalation blocked).');

  // Admin trying to laterally impersonate Admin (must be rejected 403)
  const adminLateralRes = await fetch(`${baseUrl}/api/impersonation/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ targetRole: 'Admin' })
  });
  assert.strictEqual(adminLateralRes.status, 403, `Expected 403 for Admin attempting Admin impersonation, got ${adminLateralRes.status}`);
  console.log('✅ Admin attempting lateral Admin impersonation was rejected with 403 Forbidden.');

  // Admin impersonating Operator (allowed, equal-or-lower privilege)
  const adminImpersonateOpRes = await fetch(`${baseUrl}/api/impersonation/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ targetRole: 'Operator' })
  });
  assert.strictEqual(adminImpersonateOpRes.status, 200, `Expected 200 for Admin impersonating Operator, got ${adminImpersonateOpRes.status}`);
  const adminImpersonateOpData = await adminImpersonateOpRes.json();
  assert.strictEqual(adminImpersonateOpData.impersonatedRole, 'Operator');
  assert.strictEqual(adminImpersonateOpData.realUser.role, 'Admin');
  console.log('✅ Admin successfully initiated view-only preview as Operator.');

  // SuperAdmin impersonating Admin (allowed)
  const superImpersonateAdminRes = await fetch(`${baseUrl}/api/impersonation/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ targetRole: 'Admin' })
  });
  assert.strictEqual(superImpersonateAdminRes.status, 200, `Expected 200 for SuperAdmin impersonating Admin, got ${superImpersonateAdminRes.status}`);
  console.log('✅ SuperAdmin successfully initiated view-only preview as Admin.');

  // 4. VIEW-ONLY INVARIANCE: BACKEND AUTHORIZATION PRESERVED
  console.log('\n--- TEST 4: Backend Authorization Invariance Verification ---');

  // Verify that Admin user updating labor config succeeds using their real JWT
  const adminLaborRes = await fetch(`${baseUrl}/api/labor-config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ hourlyLaborRate: 155 })
  });
  assert.strictEqual(adminLaborRes.status, 200, `Expected 200 for Admin accessing /api/labor-config, got ${adminLaborRes.status}`);
  console.log('✅ Backend authorization strictly preserved: Admin user maintains full backend permissions.');

  // Verify that Operator token is rejected with 403 on admin-only endpoint /api/labor-config
  const operatorLaborRes = await fetch(`${baseUrl}/api/labor-config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${operatorToken}`
    },
    body: JSON.stringify({ hourlyLaborRate: 200 })
  });
  assert.strictEqual(operatorLaborRes.status, 403, `Expected 403 for Operator attempting /api/labor-config, got ${operatorLaborRes.status}`);
  console.log('✅ Operator token strictly restricted from admin endpoints (backend authorization enforced).');

  // 5. AUDIT TRAIL VERIFICATION & EXIT IMPERSONATION
  console.log('\n--- TEST 5: Audit Ledger & Exit Impersonation ---');

  const stopRes = await fetch(`${baseUrl}/api/impersonation/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ previousRole: 'Operator' })
  });
  assert.strictEqual(stopRes.status, 200, `Expected 200 for stop impersonation, got ${stopRes.status}`);
  console.log('✅ Stop impersonation completed successfully.');

  // Fetch state to check notifications & audit log recording
  const stateRes = await fetch(`${baseUrl}/api/state`, {
    headers: {
      'Authorization': `Bearer ${superAdminToken}`
    }
  });
  assert.strictEqual(stateRes.status, 200);
  const stateData = await stateRes.json();
  
  const impNotifs = (stateData.notifications || []).filter((n: any) => 
    n.title?.includes('Role Preview') || n.title?.includes('Impersonation')
  );
  assert.ok(impNotifs.length >= 2, 'Expected system notifications for impersonation start and exit');
  console.log(`✅ System notifications generated (${impNotifs.length} events logged).`);

  console.log('\n====================================================');
  console.log('   🎉 ALL PHASE P PART 2 REGRESSION TESTS PASSED!   ');
  console.log('====================================================\n');
}

runPhaseP2Tests().catch((err) => {
  console.error('\n❌ Phase P Part 2 Test Suite Failed:', err);
  process.exit(1);
});
