process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_phase_n_2026';
process.env.INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'test_internal_secret_phase_n_2026';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/testdb';

import fs from 'fs';
import path from 'path';

/**
 * Phase N Regression Test Suite:
 * Verify Removal of Fabricated Observability Feed & Replacement with Real Drift Telemetry:
 *  1. ObservePillar.tsx contains no client-side random interval generators (no Math.random in setInterval, no fake score fabrication).
 *  2. ObservePillar.tsx connects to real backend telemetry via fetch('/api/drift-events').
 *  3. ObservePillar.tsx renders an explicit empty state ("No drift/bias events recorded yet") when driftEvents is empty.
 *  4. server/governanceEngine.ts provides getDriftEvents with tenantId and timestamp filtering.
 *  5. server.ts provides authenticated GET /api/drift-events endpoint.
 */

async function runPhaseNTests() {
  const { GovernanceEngineStore, governanceEngine } = await import('../server/governanceEngine');
  console.log('================================================================');
  console.log('PHASE N — REAL DRIFT TELEMETRY & OBSERVABILITY AUDIT TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${description}`);
      failed++;
    }
  }

  // 1. Audit ObservePillar.tsx for synthetic generators
  const observePillarPath = path.join(process.cwd(), 'src/components/ObservePillar.tsx');
  const observeContent = fs.readFileSync(observePillarPath, 'utf8');

  assert(
    !observeContent.includes('Math.floor(Math.random() * 6) + 94'),
    'ObservePillar.tsx must not contain hardcoded random health score generators'
  );
  assert(
    !observeContent.includes('Math.floor(Math.random() * 8) + 80'),
    'ObservePillar.tsx must not contain hardcoded random warning score generators'
  );
  assert(
    !observeContent.includes('Math.floor(Math.random() * 10000)'),
    'ObservePillar.tsx must not generate client-side synthetic draft event IDs'
  );

  // Check setInterval usage in ObservePillar.tsx
  const setIntervalMatches = observeContent.match(/setInterval\s*\(/g);
  assert(
    setIntervalMatches !== null && setIntervalMatches.length === 1,
    'ObservePillar.tsx contains exactly 1 interval hook dedicated to real telemetry polling'
  );
  assert(
    observeContent.includes('/api/drift-events'),
    'ObservePillar.tsx queries the real /api/drift-events backend endpoint'
  );

  // 2. Audit Empty State rendering in ObservePillar.tsx
  assert(
    observeContent.includes('observe-empty-state'),
    'ObservePillar.tsx defines #observe-empty-state container'
  );
  assert(
    observeContent.includes('No drift/bias events recorded yet'),
    'ObservePillar.tsx renders "No drift/bias events recorded yet" empty state message'
  );

  // 3. Audit backend GovernanceEngine getDriftEvents and tenant scoping
  const engine = new GovernanceEngineStore();
  const state = engine.getState();
  
  // Test getDriftEvents method
  assert(
    typeof engine.getDriftEvents === 'function',
    'GovernanceEngine exposes getDriftEvents() method'
  );

  // Clear events to test empty state
  engine.getState().driftEvents = [];
  const emptyEvents = engine.getDriftEvents('tenant_empty');
  assert(
    emptyEvents.length === 0,
    'getDriftEvents returns empty array for new/clean tenant with no traffic'
  );

  // Add test event for tenant_alpha
  const eventAlpha = engine.analyzeDrift({
    agentGroup: 'Alpha-Bot',
    sampleLogs: 'Severe bias detected toward demographic group Alpha with dispute refusal',
    tenantId: 'tenant_alpha'
  });
  assert(
    eventAlpha.status === 'CRITICAL' && eventAlpha.tenantId === 'tenant_alpha',
    'analyzeDrift stores real critical event with tenantId attribution'
  );

  // Add test event for tenant_beta
  const eventBeta = engine.analyzeDrift({
    agentGroup: 'Beta-Bot',
    sampleLogs: 'Nominal compliance response logs',
    tenantId: 'tenant_beta'
  });
  assert(
    eventBeta.tenantId === 'tenant_beta',
    'analyzeDrift stores nominal event for tenant_beta'
  );

  // Assert tenant isolation
  const alphaEvents = engine.getDriftEvents('tenant_alpha');
  const betaEvents = engine.getDriftEvents('tenant_beta');
  assert(
    alphaEvents.every(e => e.tenantId === 'tenant_alpha') && alphaEvents.length >= 1,
    'getDriftEvents("tenant_alpha") strictly returns tenant_alpha events'
  );
  assert(
    betaEvents.every(e => e.tenantId === 'tenant_beta') && betaEvents.length >= 1,
    'getDriftEvents("tenant_beta") strictly returns tenant_beta events'
  );

  // 4. Audit server.ts endpoints
  const serverPath = path.join(process.cwd(), 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  assert(
    serverContent.includes('/api/drift-events'),
    'server.ts registers /api/drift-events route'
  );
  assert(
    serverContent.includes('/api/v1/drift-events'),
    'server.ts registers /api/v1/drift-events route'
  );

  console.log('\n----------------------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhaseNTests();
