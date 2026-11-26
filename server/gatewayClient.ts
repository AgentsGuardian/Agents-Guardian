export interface GatewayEdgeResponse {
  id?: string;
  tenant_id?: string;
  status: 'AUTHORIZED' | 'HALTED' | 'ERROR';
  authorized: boolean;
  policy_violated?: string;
  latency_ms?: number;
  verified_cost_usd?: number;
  ledger_hash?: string;
  reason?: string;
  error?: string;
  code?: string;
}

export async function forwardToGatewayEdge(
  payload: {
    tenant_id?: string;
    agent_id?: string;
    agent_name?: string;
    action?: string;
    endpoint?: string;
    session_id?: string;
    cost_est_usd?: number;
    parameters?: any;
    prompt_text?: string;
  },
  clientHeaders: Record<string, string | string[] | undefined> = {}
): Promise<{ status: number; data: GatewayEdgeResponse }> {
  const gatewayUrl = process.env.GATEWAY_EDGE_URL;
  if (!gatewayUrl) {
    return {
      status: 503,
      data: {
        status: 'HALTED',
        authorized: false,
        error: 'Gateway Edge Interception Service Unavailable',
        code: 'GATEWAY_EDGE_OFFLINE',
        reason: 'The canonical gateway-edge governance engine is unreachable.'
      }
    };
  }
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Internal-Service-Key': internalSecret,
  };

  if (clientHeaders['x-guardian-key']) {
    headers['X-Guardian-Key'] = String(clientHeaders['x-guardian-key']);
  }
  if (clientHeaders['x-api-key']) {
    headers['X-API-Key'] = String(clientHeaders['x-api-key']);
  }
  if (clientHeaders['authorization']) {
    headers['Authorization'] = String(clientHeaders['authorization']);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${gatewayUrl}/api/v1/intercept`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));
    return {
      status: response.status,
      data: data as GatewayEdgeResponse
    };
  } catch (err: any) {
    console.warn('[Gateway Edge Client] Gateway-edge service unreachable:', err?.message || err);
    return {
      status: 503,
      data: {
        status: 'HALTED',
        authorized: false,
        error: 'Gateway Edge Interception Service Unavailable',
        code: 'GATEWAY_EDGE_OFFLINE',
        reason: 'The canonical gateway-edge governance engine is unreachable.'
      }
    };
  }
}
