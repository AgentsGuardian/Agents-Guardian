/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Single source of truth SLA Latency limit in milliseconds across the platform.
 */
export const GUARANTEED_SLA_MS = 35;

/**
 * Formats inline tooltips for SLA compliance checking based on request latency.
 */
export function formatSlaTooltip(latencyMs: number): string {
  if (latencyMs > GUARANTEED_SLA_MS) {
    return `Authorized (Slow — SLA Breach: Exceeded ${GUARANTEED_SLA_MS}ms Target)`;
  }
  return `Authorized (Optimal — Within ${GUARANTEED_SLA_MS}ms SLA Target)`;
}

/**
 * Unified Transaction ID Factory across all system modules.
 */
export function generateTransactionId(prefix = 'KG-GAAS'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Unified Status Derivation Engine for agents, gateways, and health indicators.
 * - health >= 85 and no active halt -> HEALTHY
 * - health 60-84, or warning flags present -> EVALUATING
 * - health < 60, or active halt -> HALT ALERT
 */
export function getStatusBadge(
  health: number,
  hasActiveHalt: boolean,
  hasWarningFlag: boolean
): 'HEALTHY' | 'EVALUATING' | 'HALT ALERT' {
  if (health < 60 || hasActiveHalt) return 'HALT ALERT';
  if (health < 85 || hasWarningFlag) return 'EVALUATING';
  return 'HEALTHY';
}

/**
 * Strips raw markdown syntax characters like `**` and backticks from strings
 * to ensure clean UI typography without unrendered markdown tokens.
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1');
}

/**
 * Reconciles ISO date string formatting across all tabs to present a clean, consistent timestamp.
 * Output format: MMM DD, YYYY · HH:mm:ss (e.g. Jul 31, 2026 · 14:05:22)
 */
export function formatTimestamp(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${month} ${day}, ${year} · ${hours}:${minutes}:${seconds}`;
  } catch {
    return isoString;
  }
}

/**
 * Formats currency values consistently.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

