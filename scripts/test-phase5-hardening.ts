import { governanceEngine } from '../server/governanceEngine.js';

async function runPhase5Tests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING PHASE 5: GCP INFRA HARDENING & MARKETPLACE SUITE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  // 1. Test Marketplace Webhook Auto-Provisioning (Subscribe)
  console.log('--- TEST 1: GCP Marketplace Webhook Auto-Provisioning ---');
  const testTenantAccountId = `MKT-TEST-${Date.now()}`;
  const webhookResult = governanceEngine.handleMarketplaceWebhook({
    eventType: 'ENTITLEMENT_CREATION_REQUESTED',
    accountName: 'Stark Industries Corp',
    gcpMarketplaceAccountId: testTenantAccountId,
    planTier: 'ENTERPRISE'
  });

  assert(webhookResult.success === true, 'Webhook returned success: true');
  assert(webhookResult.action === 'TENANT_PROVISIONED', 'Action is TENANT_PROVISIONED');
  assert(webhookResult.billingStatus === 'ACTIVE', 'Billing status set to ACTIVE');
  assert(typeof webhookResult.apiKey === 'string' && webhookResult.apiKey.startsWith('ag_live_'), 'Unique API key issued');
  assert(webhookResult.defaultPolicies.length === 3, 'Created 3 default policies (Security, Ethics, Finance)');
  assert(webhookResult.budgetCap === 500, 'Enterprise plan allocated default $500 budget cap');

  const provisionedTenantId = webhookResult.tenant.id;

  // 2. Test Tenant Storage & Lookup
  console.log('\n--- TEST 2: Tenant Registry & API Key Lookup ---');
  const tenant = governanceEngine.getTenant(provisionedTenantId);
  assert(tenant !== undefined, `Tenant '${provisionedTenantId}' found in system registry`);
  assert(tenant?.name === 'Stark Industries Corp', 'Tenant name matches webhook payload');

  const policies = governanceEngine.getPolicies(provisionedTenantId);
  assert(policies.length === 3, 'Retrieved 3 tenant-scoped policy bundles');

  // 3. Test Marketplace Plan Upgrade
  console.log('\n--- TEST 3: GCP Marketplace Plan Change/Upgrade ---');
  const upgradeResult = governanceEngine.handleMarketplaceWebhook({
    eventType: 'ENTITLEMENT_PLAN_CHANGED',
    tenantId: provisionedTenantId,
    gcpMarketplaceAccountId: testTenantAccountId,
    planTier: 'ENTERPRISE_CUSTOM'
  });

  assert(upgradeResult.success === true, 'Plan change returned success');
  assert(upgradeResult.newPlanTier === 'ENTERPRISE_CUSTOM', 'Plan updated to ENTERPRISE_CUSTOM');
  assert(upgradeResult.newBudgetCap === 1000, 'Budget cap automatically increased to $1000');

  // 4. Test Intercept Requests & Marketplace Metering Emission
  console.log('\n--- TEST 4: Intercept Requests & Metering Event Emission ---');
  
  // Simulate 5 agent intercept evaluations for this tenant
  for (let i = 0; i < 5; i++) {
    await governanceEngine.evaluateRequest({
      actionCommand: `execute_query_stark_${i}`,
      agentId: `AG-STARK-${i}`,
      endpoint: '/v1/intercept',
      estimatedCost: 0.10,
      tenantId: provisionedTenantId
    });
  }

  const meteringResult = governanceEngine.processMarketplaceMeteringEvent(
    provisionedTenantId,
    'agentsguardian.googleapis.com/intercepted_requests',
    5
  );

  assert(meteringResult.status === 'REPORTED_TO_GCP_COMMERCE_PROCUREMENT_API', 'Metering event reported');
  assert(meteringResult.quantity === 5, 'Quantity matches 5 evaluated requests');
  assert(meteringResult.tenantId === provisionedTenantId, 'Telemetry event scoped to correct tenant');
  assert(typeof meteringResult.ledgerHash === 'string', 'Event anchored with cryptographic audit ledger hash');

  // 5. Test Metering Reconciliation
  console.log('\n--- TEST 5: Raw Request Logs vs Emitted Metering Reconciliation ---');
  const reconciliationResult = governanceEngine.reconcileMarketplaceMetering(provisionedTenantId);

  assert(reconciliationResult.tenantId === provisionedTenantId, 'Reconciled correct tenant ID');
  assert(reconciliationResult.status === 'RECONCILED_EXACT_MATCH', 'Status is RECONCILED_EXACT_MATCH');
  assert(reconciliationResult.auditPassed === true, 'Audit check passed with 0 discrepancy');
  assert(reconciliationResult.discrepancyCount === 0, 'Discrepancy count is exactly 0');
  assert(reconciliationResult.discrepancyPercentage === '0.00%', 'Discrepancy percentage is 0.00%');

  // 6. Test Cross-Tenant Isolation
  console.log('\n--- TEST 6: Automated Cross-Tenant Isolation Check ---');
  const isolationResult = governanceEngine.verifyMultiTenantIsolation(provisionedTenantId, 'tenant_default');
  
  assert(isolationResult.isolationCheckPassed === true, 'Multi-tenant isolation check passed');
  assert(isolationResult.result === 'PASSED_ZERO_CROSS_TENANT_LEAKAGE', 'Result is PASSED_ZERO_CROSS_TENANT_LEAKAGE');
  
  const allAssertionsPassed = isolationResult.assertions.every((a: any) => a.status === 'PASSED');
  assert(allAssertionsPassed, 'All 5 isolation assertions (Policies, Ledger, Redis, Budget, Scope) passed');

  // 7. Test Marketplace Subscription Cancellation
  console.log('\n--- TEST 7: GCP Marketplace Subscription Cancellation ---');
  const cancelResult = governanceEngine.handleMarketplaceWebhook({
    eventType: 'ENTITLEMENT_CANCELLED',
    tenantId: provisionedTenantId,
    gcpMarketplaceAccountId: testTenantAccountId
  });

  assert(cancelResult.success === true, 'Cancellation returned success');
  assert(cancelResult.billingStatus === 'SUSPENDED_CANCELLED', 'Billing status set to SUSPENDED_CANCELLED');

  const cancelledPolicies = governanceEngine.getPolicies(provisionedTenantId);
  const allDisabled = cancelledPolicies.every(p => p.enabled === false);
  assert(allDisabled, 'All tenant policies disabled upon subscription cancellation');

  console.log('\n===============================================================');
  console.log(`📊 SUMMARY: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('===============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPhase5Tests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
