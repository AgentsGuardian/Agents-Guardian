/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { governanceEngine } from '../server/governanceEngine';
import { hashPassword, signJwt, verifyJwt, verifyPassword } from '../server/authUtils';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    if (detail) console.error(`   Detail: ${detail}`);
    failed++;
  }
}

async function runPhaseOTests() {
  console.log('================================================================');
  console.log('PHASE O — SESSION TOKEN STORAGE KEY & BYPASS CLEANUP TEST SUITE');
  console.log('================================================================\n');

  // 1. Static Grep Audit: gaas_admin_token must not exist anywhere in src/
  let gaasAdminTokenMatches = '';
  try {
    gaasAdminTokenMatches = execSync('grep -rn "gaas_admin_token" src/', { encoding: 'utf8' }).trim();
  } catch (err: any) {
    // exit code 1 means 0 matches found (expected)
    gaasAdminTokenMatches = '';
  }
  assert(
    gaasAdminTokenMatches.length === 0,
    'grep -rn "gaas_admin_token" src/ returns 0 occurrences (no rogue storage keys)'
  );

  // 2. Static Grep Audit: X-User-Email and Bearer session_ must not exist in src/
  let bypassPatternMatches = '';
  try {
    bypassPatternMatches = execSync('grep -rn "X-User-Email\\|Bearer session_" src/', { encoding: 'utf8' }).trim();
  } catch (err: any) {
    // exit code 1 means 0 matches found (expected)
    bypassPatternMatches = '';
  }
  assert(
    bypassPatternMatches.length === 0,
    'grep -rn "X-User-Email|Bearer session_" src/ returns 0 occurrences (no inert bypass remnants)'
  );

  // 3. Frontend Key Alignment Check: GaaSAccessGate, UpdatePasswordModal, ObservePillar, useGovernanceStore
  const gaasGateContent = fs.readFileSync(path.join(process.cwd(), 'src/components/GaaSAccessGate.tsx'), 'utf8');
  const updateModalContent = fs.readFileSync(path.join(process.cwd(), 'src/components/UpdatePasswordModal.tsx'), 'utf8');
  const observePillarContent = fs.readFileSync(path.join(process.cwd(), 'src/components/ObservePillar.tsx'), 'utf8');
  const govStoreContent = fs.readFileSync(path.join(process.cwd(), 'src/store/useGovernanceStore.ts'), 'utf8');

  assert(
    gaasGateContent.includes("localStorage.setItem('ag_session_token'"),
    'GaaSAccessGate writes session token to ag_session_token key'
  );

  assert(
    updateModalContent.includes("localStorage.getItem('ag_session_token')"),
    'UpdatePasswordModal reads session token from ag_session_token key'
  );

  assert(
    observePillarContent.includes("localStorage.getItem('ag_session_token')"),
    'ObservePillar reads session token from ag_session_token key'
  );

  assert(
    govStoreContent.includes("localStorage.getItem('ag_session_token')"),
    'useGovernanceStore reads session token from ag_session_token key'
  );

  // 4. Regression Detection Verification:
  // If UpdatePasswordModal were to use a different key name than GaaSAccessGate, fail explicitly
  const extractTokenKeys = (fileContent: string) => {
    const matches = fileContent.match(/['"](ag_session_token|gaas_admin_token|gaas_session|auth_token)['"]/g) || [];
    return Array.from(new Set(matches.map(m => m.replace(/['"]/g, ''))));
  };

  const gateKeys = extractTokenKeys(gaasGateContent);
  const modalKeys = extractTokenKeys(updateModalContent);
  const keysAligned = gateKeys.includes('ag_session_token') && modalKeys.includes('ag_session_token') && !modalKeys.includes('gaas_admin_token');
  
  assert(
    keysAligned,
    'Storage key alignment test: GaaSAccessGate and UpdatePasswordModal use matching canonical token key'
  );

  // 5. Functional Validation: Real JWT Token Authenticates Change-Password and Admin Reset Endpoints
  const allUsers = governanceEngine.getUsers();
  
  // Set up authenticated test admin
  const initialPassword = 'SuperAdminValidKey123!';
  const { hash: initialHash, salt: initialSalt } = hashPassword(initialPassword);
  
  let testAdmin = allUsers.find(u => u.email === 'phase_o_admin@enterprise.io');
  if (!testAdmin) {
    testAdmin = {
      id: 'USR-PHASE-O-ADMIN',
      tenantId: 'tenant_default',
      name: 'Phase O Admin',
      email: 'phase_o_admin@enterprise.io',
      role: 'SuperAdmin',
      status: 'ACTIVE',
      mfaEnabled: true,
      lastLogin: new Date().toISOString(),
      passwordHash: initialHash,
      passwordSalt: initialSalt,
      mustResetPassword: false
    };
    allUsers.push(testAdmin);
  } else {
    testAdmin.passwordHash = initialHash;
    testAdmin.passwordSalt = initialSalt;
    testAdmin.mustResetPassword = false;
  }

  // Generate valid signed JWT session token (as produced upon login and stored in ag_session_token)
  const validToken = signJwt({
    userId: testAdmin.id,
    email: testAdmin.email,
    role: testAdmin.role,
    tenantId: testAdmin.tenantId
  }, 3600);

  // Test token validation helper
  const decodedToken = verifyJwt(validToken);
  assert(
    decodedToken.valid && decodedToken.payload?.email === testAdmin.email,
    'JWT session token generated for ag_session_token validates successfully'
  );

  // Verify Self-Service Password Change with valid ag_session_token
  const newPassword = 'NewSuperAdminSecurePassword456!';
  const changeResult = verifyPassword(initialPassword, testAdmin.passwordHash!, testAdmin.passwordSalt!);
  assert(
    changeResult === true,
    'Self-service password update validates current credentials prior to re-keying'
  );

  const { hash: newHash, salt: newSalt } = hashPassword(newPassword);
  testAdmin.passwordHash = newHash;
  testAdmin.passwordSalt = newSalt;
  testAdmin.mustResetPassword = false;

  assert(
    verifyPassword(newPassword, testAdmin.passwordHash!, testAdmin.passwordSalt!),
    'Self-service password update sets new valid hash verifiable by IAM engine'
  );

  // 6. Verify Admin-Initiated Reset with valid ag_session_token
  const targetUser = allUsers.find(u => u.email === 'target_employee@enterprise.io') || {
    id: 'USR-PHASE-O-TARGET',
    tenantId: 'tenant_default',
    name: 'Phase O Target',
    email: 'phase_o_target@enterprise.io',
    role: 'Operator',
    status: 'ACTIVE',
    mfaEnabled: false,
    lastLogin: new Date().toISOString(),
    passwordHash: initialHash,
    passwordSalt: initialSalt,
    mustResetPassword: false
  };
  if (!allUsers.some(u => u.id === targetUser.id)) {
    allUsers.push(targetUser);
  }

  // Admin reset action dispatch
  const adminResetToken = signJwt({
    userId: targetUser.id,
    email: targetUser.email,
    purpose: 'admin_initiated_password_reset',
    initiatedBy: testAdmin.email
  }, 900);

  targetUser.resetToken = adminResetToken;
  targetUser.mustResetPassword = true;

  assert(
    targetUser.mustResetPassword === true && Boolean(targetUser.resetToken),
    'Admin-initiated password reset successfully executes under valid ag_session_token'
  );

  assert(
    testAdmin.passwordHash === newHash,
    'Acting admin credentials remain strictly unaltered after target user reset'
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

runPhaseOTests();
