/**
 * Phase G Black-Box Integration Test Suite
 * Tests Real Tenant API Key Validation, Resolution in Gateway/Intercept,
 * Anti-Spoofing Isolation, and Unregistered Key Rejection (401).
 */

import assert from 'assert';
import { signJwt } from '../server/authUtils';

async function runPhaseGTests() {
  console.log('====================================================');
  console.log('   AGENTSGUARDIAN PHASE G HARDENING TEST SUITE      ');
  console.log('====================================================\n');

  const baseUrl = process.env.STAGING_URL || 'http://localhost:3000';
  console.log(`Target Gateway URL: ${baseUrl}\n`);

  let adminJwt = '';
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mritunjoysingh@gmail.com', password: 'admin123' })
  });
  if (loginRes.ok) {
    const loginData = await loginRes.json();
    adminJwt = loginData.token;
    if (loginData.mustResetPassword) {
      // Call change password to satisfy reset requirement
      const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminJwt}`
        },
        body: JSON.stringify({ currentPassword: 'admin123', newPassword: 'StrongPassword12345!' })
      });
      if (changeRes.ok) {
        const changeData = await changeRes.json();
        adminJwt = changeData.token || adminJwt;
      }
    }
  }

  if (!adminJwt) {
    adminJwt = signJwt({
      userId: 'USR-000',
      email: 'mritunjoysingh@gmail.com',
      role: 'SuperAdmin'
    }, 3600);
  }

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminJwt}`
  };

  // 1. TEST UNREGISTERED API KEY REJECTION (401)
  console.log('--- TEST 1: Unregistered API Key Rejection (401) ---');

  // 1a. Missing API Key
  const missingKeyRes = await fetch(`${baseUrl}/api/v1/intercept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'shell.exec', agent_id: 'AGENT-TEST' })
  });
  assert.strictEqual(missingKeyRes.status, 401, 'Missing API key returns HTTP 401 Unauthorized');
  const missingData = await missingKeyRes.json();
  assert(missingData.error && missingData.error.includes('Unauthorized'), 'Response contains Unauthorized error');
  console.log('✔ Missing API key correctly rejected with HTTP 401.');

  // 1b. Unregistered / Well-formed fake API key
  const fakeKey = 'ag_live_' + 'a1b2c3d4e5f67890'.repeat(3);
  const fakeKeyRes = await fetch(`${baseUrl}/api/v1/intercept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Guardian-Key': fakeKey
    },
    body: JSON.stringify({ action: 'shell.exec', agent_id: 'AGENT-TEST' })
  });
  assert.strictEqual(fakeKeyRes.status, 401, 'Unregistered API key returns HTTP 401 Unauthorized');
  console.log('✔ Unregistered well-formed API key correctly rejected with HTTP 401.');


  // 2. PROVISION TWO TEST TENANTS WITH REAL API KEYS
  console.log('\n--- TEST 2: Provision Two Test Tenants with Real Keys ---');

  const tenantAId = `tenant_alpha_${Date.now()}`;
  const tenantAKey = `ag_live_alpha_${Date.now()}_key1234567890`;

  const tenantBId = `tenant_beta_${Date.now()}`;
  const tenantBKey = `ag_live_beta_${Date.now()}_key0987654321`;

  // Provision Tenant A
  const provARes = await fetch(`${baseUrl}/api/v1/marketplace/tenants`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      tenantId: tenantAId,
      name: 'Tenant Alpha Enterprise',
      planTier: 'ENTERPRISE',
      apiKey: tenantAKey,
      budgetCap: 100.0
    })
  });
  if (provARes.status !== 200) {
    console.error('provARes status:', provARes.status, 'body:', await provARes.text());
  }
  assert.strictEqual(provARes.status, 200, 'Provisioning Tenant A returns HTTP 200');
  const provAData = await provARes.json();
  assert.strictEqual(provAData.success, true, 'Tenant A provisioned successfully');
  console.log(`✔ Provisioned Tenant A (${tenantAId}) with API Key ${tenantAKey.slice(0, 16)}...`);

  // Provision Tenant B
  const provBRes = await fetch(`${baseUrl}/api/v1/marketplace/tenants`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      tenantId: tenantBId,
      name: 'Tenant Beta Enterprise',
      planTier: 'ENTERPRISE',
      apiKey: tenantBKey,
      budgetCap: 100.0
    })
  });
  assert.strictEqual(provBRes.status, 200, 'Provisioning Tenant B returns HTTP 200');
  const provBData = await provBRes.json();
  assert.strictEqual(provBData.success, true, 'Tenant B provisioned successfully');
  console.log(`✔ Provisioned Tenant B (${tenantBId}) with API Key ${tenantBKey.slice(0, 16)}...`);


  // 3. INTERCEPT REQUEST SCOPED TO TENANT A
  console.log('\n--- TEST 3: Intercept Request Scoped to Tenant A ---');

  const interceptARes = await fetch(`${baseUrl}/api/v1/intercept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Guardian-Key': tenantAKey
    },
    body: JSON.stringify({
      agent_id: 'AGENT-ALPHA-01',
      agent_name: 'Alpha Search Bot',
      action: 'query.search',
      estimated_cost: 0.25,
      prompt_text: 'Search alpha enterprise records'
    })
  });

  assert.strictEqual(interceptARes.status, 200, 'Intercept request with Tenant A key returns HTTP 200');
  const interceptAData = await interceptARes.json();
  assert.strictEqual(interceptAData.authorized, true, 'Tenant A request authorized');
  console.log('✔ Tenant A request successfully processed and authorized.');


  // 4. INTERCEPT REQUEST SCOPED TO TENANT B & ISOLATION VERIFICATION
  console.log('\n--- TEST 4: Intercept Request Scoped to Tenant B & Isolation Check ---');

  const interceptBRes = await fetch(`${baseUrl}/api/v1/intercept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Guardian-Key': tenantBKey
    },
    body: JSON.stringify({
      agent_id: 'AGENT-BETA-01',
      agent_name: 'Beta Finance Bot',
      action: 'finance.reconcile',
      estimated_cost: 0.50,
      prompt_text: 'Reconcile beta accounts'
    })
  });

  assert.strictEqual(interceptBRes.status, 200, 'Intercept request with Tenant B key returns HTTP 200');
  const interceptBData = await interceptBRes.json();
  assert.strictEqual(interceptBData.authorized, true, 'Tenant B request authorized');
  console.log('✔ Tenant B request successfully processed and authorized.');

  // Verify State Isolation via Admin API
  const stateRes = await fetch(`${baseUrl}/api/state`, {
    method: 'GET',
    headers: adminHeaders
  });
  assert.strictEqual(stateRes.status, 200, 'Fetch state returns HTTP 200');
  const state = await stateRes.json();

  // Find governed agents for Tenant A and Tenant B
  const agentsA = state.governedAgents.filter((a: any) => a.tenantId === tenantAId);
  const agentsB = state.governedAgents.filter((a: any) => a.tenantId === tenantBId);

  assert(agentsA.length > 0, 'Governed agent registered under Tenant A ID');
  assert(agentsB.length > 0, 'Governed agent registered under Tenant B ID');
  assert.strictEqual(agentsA[0].id, 'AGENT-ALPHA-01', 'Tenant A agent ID matches payload');
  assert.strictEqual(agentsB[0].id, 'AGENT-BETA-01', 'Tenant B agent ID matches payload');
  console.log('✔ Governed agents strictly isolated between Tenant A and Tenant B.');


  // 5. TEST ANTI-SPOOFING PROTECTION
  console.log('\n--- TEST 5: Anti-Spoofing Protection (Cross-Tenant Identity Spoofing Blocked) ---');

  const spoofRes = await fetch(`${baseUrl}/api/v1/intercept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Guardian-Key': tenantAKey // Tenant A's authentic key
    },
    body: JSON.stringify({
      tenant_id: tenantBId, // Claiming Tenant B in request body!
      agent_id: 'AGENT-ALPHA-01',
      action: 'query.search'
    })
  });

  assert.strictEqual(spoofRes.status, 403, 'Cross-tenant spoofing attempt returns HTTP 403 Forbidden');
  const spoofData = await spoofRes.json();
  assert.strictEqual(spoofData.code, 'TENANT_SPOOFING_BLOCKED', 'Error code indicates TENANT_SPOOFING_BLOCKED');
  console.log('✔ Anti-spoofing guard successfully blocked client-supplied tenant_id mismatch.');

  console.log('\n====================================================');
  console.log('   ALL PHASE G SECURITY INTEGRATION TESTS PASSED!   ');
  console.log('====================================================');
}

runPhaseGTests().catch(err => {
  console.error('Phase G Test Failure:', err);
  process.exit(1);
});
