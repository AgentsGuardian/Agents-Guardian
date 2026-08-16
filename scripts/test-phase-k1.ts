import 'dotenv/config';
import http from 'http';

/**
 * Phase K1 Verification Test:
 * Verify /api/v1/intercept and its aliases (/v1/intercept, /intercept)
 * proxy cleanly to gateway-edge with fail-closed security and proper headers.
 */

const SERVER_PORT = 3000;
const GATEWAY_PORT = 8081;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'ag_internal_mesh_secret_2026_x99';

async function postJson(url: string, headers: Record<string, string>, body: any): Promise<{ status: number; data: any }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTest() {
  console.log('====================================================');
  console.log('PHASE K1 — /api/v1/intercept PROXY TO GATEWAY-EDGE');
  console.log('====================================================\n');

  const capturedCalls: Array<{ url: string; headers: http.IncomingHttpHeaders; body: any }> = [];

  const mockGateway = http.createServer((req, res) => {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(bodyStr); } catch {}
      capturedCalls.push({
        url: req.url || '',
        headers: req.headers,
        body: parsed
      });

      const bodyObj: any = parsed;
      const isBlocked = bodyObj.action?.includes('rm -rf');

      if (isBlocked) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'KG-INTERCEPT-HALTED',
          tenant_id: bodyObj.tenant_id,
          status: 'HALTED',
          authorized: false,
          policy_violated: 'POL-SEC-02',
          latency_ms: 2,
          reason: 'Raw shell deletion command blocked.'
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'KG-INTERCEPT-AUTH',
          tenant_id: bodyObj.tenant_id,
          status: 'AUTHORIZED',
          authorized: true,
          latency_ms: 2
        }));
      }
    });
  });

  await new Promise<void>(resolve => mockGateway.listen(GATEWAY_PORT, resolve));
  process.env.GATEWAY_EDGE_URL = `http://localhost:${GATEWAY_PORT}`;

  const clientHeaders = {
    'X-Guardian-Key': 'ag_live_tenant_default_production_key_2026'
  };

  try {
    // 1. Test canonical endpoint: /api/v1/intercept
    console.log('Test 1: POST /api/v1/intercept authorized flow...');
    const res1 = await postJson(`http://localhost:${SERVER_PORT}/api/v1/intercept`, clientHeaders, {
      agent_id: 'GA-TEST-01',
      action: 'process_payment',
      cost_est_usd: 0.05
    });
    if (res1.status !== 200 || !res1.data.authorized) {
      throw new Error(`Failed /api/v1/intercept: ${JSON.stringify(res1)}`);
    }
    console.log('✅ PASS: /api/v1/intercept proxied and authorized.\n');

    // 2. Test alias 1: /v1/intercept
    console.log('Test 2: POST /v1/intercept alias flow...');
    const res2 = await postJson(`http://localhost:${SERVER_PORT}/v1/intercept`, clientHeaders, {
      agent_id: 'GA-TEST-02',
      action: 'read_status'
    });
    if (res2.status !== 200 || !res2.data.authorized) {
      throw new Error(`Failed /v1/intercept alias: ${JSON.stringify(res2)}`);
    }
    console.log('✅ PASS: /v1/intercept alias proxied and authorized.\n');

    // 3. Test alias 2: /intercept
    console.log('Test 3: POST /intercept alias flow...');
    const res3 = await postJson(`http://localhost:${SERVER_PORT}/intercept`, clientHeaders, {
      agent_id: 'GA-TEST-03',
      action: 'query_inventory'
    });
    if (res3.status !== 200 || !res3.data.authorized) {
      throw new Error(`Failed /intercept alias: ${JSON.stringify(res3)}`);
    }
    console.log('✅ PASS: /intercept alias proxied and authorized.\n');

    // 4. Test blocked policy response propagation
    console.log('Test 4: Threat Interception with policy block propagation...');
    const res4 = await postJson(`http://localhost:${SERVER_PORT}/api/v1/intercept`, clientHeaders, {
      agent_id: 'GA-TEST-04',
      action: 'rm -rf /critical_data'
    });
    if (res4.status !== 403 || res4.data.status !== 'HALTED' || res4.data.policy_violated !== 'POL-SEC-02') {
      throw new Error(`Failed threat block propagation: ${JSON.stringify(res4)}`);
    }
    console.log('✅ PASS: Threat correctly halted with status 403 and POL-SEC-02.\n');

    // 5. Verify Internal Service Secret Header
    for (const call of capturedCalls) {
      if (call.headers['x-internal-service-key'] !== INTERNAL_SECRET) {
        throw new Error('Captured request did not include valid X-Internal-Service-Key header');
      }
    }
    console.log('✅ PASS: All requests delivered with authenticated X-Internal-Service-Key header.\n');

  } finally {
    mockGateway.close();
  }

  // 6. Test Fail-Closed behavior when Gateway Edge is completely Offline
  console.log('Test 6: Offline Gateway-Edge verification (fail-closed check)...');
  const resOffline = await postJson(`http://localhost:${SERVER_PORT}/api/v1/intercept`, clientHeaders, {
    agent_id: 'GA-TEST-05',
    action: 'process_payment'
  });
  if (resOffline.status !== 503 || resOffline.data.code !== 'GATEWAY_EDGE_OFFLINE') {
    throw new Error(`Expected 503 GATEWAY_EDGE_OFFLINE when gateway is offline, got: ${JSON.stringify(resOffline)}`);
  }
  console.log('✅ PASS: /api/v1/intercept correctly fails-closed with 503 GATEWAY_EDGE_OFFLINE when gateway-edge is down.\n');

  console.log('====================================================');
  console.log('PHASE K1 VERIFICATION COMPLETE — ALL TESTS PASSED!');
  console.log('====================================================');
}

runTest().catch(err => {
  console.error('❌ PHASE K1 TEST FAILED:', err);
  process.exit(1);
});
