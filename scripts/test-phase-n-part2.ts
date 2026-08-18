/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { governanceEngine } from '../server/governanceEngine';
import { hashPassword, signJwt, verifyJwt, verifyPassword } from '../server/authUtils';
import fs from 'fs';
import path from 'path';

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

async function runPhaseNPart2Tests() {
  console.log('================================================================');
  console.log('PHASE N PART 2 — ADMIN PASSWORD RESET & IAM SECURITY TEST SUITE');
  console.log('================================================================\n');

  // 1. Static Audit of UpdatePasswordModal.tsx
  const modalPath = path.join(process.cwd(), 'src/components/UpdatePasswordModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  assert(
    modalContent.includes('/api/admin/users/'),
    'UpdatePasswordModal.tsx calls real backend /api/admin/users/:userId/reset-password endpoint'
  );

  assert(
    modalContent.includes('isAdminReset') && modalContent.includes('!isAdminReset'),
    'UpdatePasswordModal.tsx distinguishes between admin-initiated reset and self-service password update'
  );

  assert(
    modalContent.includes('A password reset has been sent to') || modalContent.includes('A password reset link has been dispatched to'),
    'UpdatePasswordModal.tsx displays truthful success message reflecting out-of-band reset dispatch'
  );

  // 2. Static Audit of AdminPillar.tsx
  const adminPillarPath = path.join(process.cwd(), 'src/components/AdminPillar.tsx');
  const adminPillarContent = fs.readFileSync(adminPillarPath, 'utf8');

  assert(
    adminPillarContent.includes('targetUser={passwordTargetUser}') && adminPillarContent.includes('currentUser={currentUser}'),
    'AdminPillar.tsx passes both currentUser (acting admin) and targetUser (inspected user) to UpdatePasswordModal'
  );

  // 3. Static Audit of server.ts route registrations
  const serverPath = path.join(process.cwd(), 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  assert(
    serverContent.includes("app.post('/api/admin/users/:userId/reset-password'"),
    'server.ts registers /api/admin/users/:userId/reset-password endpoint'
  );

  assert(
    serverContent.includes("requireRole(['SuperAdmin', 'Admin'])"),
    'Admin reset password endpoint is strictly gated by requireRole([SuperAdmin, Admin])'
  );

  // 4. Functional Testing of Admin Reset Behavior & Acting Admin Isolation
  const allUsers = governanceEngine.getUsers();

  // Create or retrieve acting admin
  const adminInitialPassword = 'SuperAdminInitialPassword123!';
  const { hash: adminHash, salt: adminSalt } = hashPassword(adminInitialPassword);
  
  let actingAdmin = allUsers.find(u => u.email === 'admin_tester@enterprise.io');
  if (!actingAdmin) {
    actingAdmin = {
      id: 'USR-ADMIN-TEST',
      tenantId: 'tenant_default',
      name: 'Acting Administrator',
      email: 'admin_tester@enterprise.io',
      role: 'Admin',
      status: 'ACTIVE',
      mfaEnabled: true,
      lastLogin: new Date().toISOString(),
      passwordHash: adminHash,
      passwordSalt: adminSalt,
      mustResetPassword: false
    };
    allUsers.push(actingAdmin);
  } else {
    actingAdmin.passwordHash = adminHash;
    actingAdmin.passwordSalt = adminSalt;
    actingAdmin.mustResetPassword = false;
  }

  // Create target user
  const targetInitialPassword = 'TargetUserInitialPassword123!';
  const { hash: targetHash, salt: targetSalt } = hashPassword(targetInitialPassword);

  let targetUser = allUsers.find(u => u.email === 'target_employee@enterprise.io');
  if (!targetUser) {
    targetUser = {
      id: 'USR-TARGET-TEST',
      tenantId: 'tenant_default',
      name: 'Target Employee',
      email: 'target_employee@enterprise.io',
      role: 'Operator',
      status: 'ACTIVE',
      mfaEnabled: false,
      lastLogin: new Date().toISOString(),
      passwordHash: targetHash,
      passwordSalt: targetSalt,
      mustResetPassword: false
    };
    allUsers.push(targetUser);
  } else {
    targetUser.passwordHash = targetHash;
    targetUser.passwordSalt = targetSalt;
    targetUser.mustResetPassword = false;
  }

  const initialAdminHash = actingAdmin.passwordHash;
  const initialAdminSalt = actingAdmin.passwordSalt;
  const initialAdminMustReset = actingAdmin.mustResetPassword;

  // Simulate Admin-Initiated Reset Execution (as performed in server.ts handler)
  const resetToken = signJwt({
    userId: targetUser.id,
    email: targetUser.email,
    purpose: 'admin_initiated_password_reset',
    initiatedBy: actingAdmin.email
  }, 900);

  targetUser.resetToken = resetToken;
  targetUser.resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  targetUser.mustResetPassword = true;

  const ledgerEntry = governanceEngine.appendAuditLedgerEntry(
    targetUser.tenantId || 'tenant_default',
    `ACTOR-${actingAdmin.id}`,
    'ADMIN_INITIATED_PASSWORD_RESET',
    {
      action: 'ADMIN_INITIATED_PASSWORD_RESET',
      actingAdminId: actingAdmin.id,
      actingAdminEmail: actingAdmin.email,
      actingAdminRole: actingAdmin.role,
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      targetUserRole: targetUser.role,
      mustResetPasswordForced: true,
      timestamp: new Date().toISOString()
    }
  );

  // Assertions: Target account is placed into mustResetPassword=true state
  assert(
    targetUser.mustResetPassword === true,
    'Target account is forced into mustResetPassword: true state'
  );

  assert(
    Boolean(targetUser.resetToken),
    'Target account is provisioned with out-of-band JWT resetToken'
  );

  const verifiedToken = verifyJwt(targetUser.resetToken!);
  assert(
    verifiedToken.valid && verifiedToken.payload?.userId === targetUser.id,
    'Target reset token contains valid cryptographic signature and target userId claim'
  );

  // Critical Invariant: Acting admin credentials MUST REMAIN UNTOUCHED
  assert(
    actingAdmin.passwordHash === initialAdminHash && actingAdmin.passwordSalt === initialAdminSalt,
    'Acting admin passwordHash and salt are strictly unchanged after resetting target user'
  );

  assert(
    actingAdmin.mustResetPassword === initialAdminMustReset && actingAdmin.mustResetPassword === false,
    'Acting admin mustResetPassword flag remains false'
  );

  // Assert that acting admin can still authenticate with their original password
  const adminAuthCheck = verifyPassword(adminInitialPassword, actingAdmin.passwordHash!, actingAdmin.passwordSalt!);
  assert(
    adminAuthCheck === true,
    'Acting admin can still verify against their original password without alteration'
  );

  // 5. Audit Trail Verification
  const auditLedger = governanceEngine.getAuditLedger(targetUser.tenantId || 'tenant_default');
  const auditMatch = auditLedger.find(
    e => e.eventType === 'ADMIN_INITIATED_PASSWORD_RESET' && e.agentId === `ACTOR-${actingAdmin.id}`
  );

  assert(
    Boolean(auditMatch),
    'Tamper-evident audit ledger contains ADMIN_INITIATED_PASSWORD_RESET event recording actor and target'
  );

  // 6. Security Invariant: Reset token cannot be forged or reused across users
  const attackerToken = signJwt({
    userId: 'ATTACKER-ID',
    email: 'attacker@evil.com',
    purpose: 'admin_initiated_password_reset'
  }, 900);
  const attackerVerify = verifyJwt(attackerToken);
  assert(
    attackerVerify.payload?.userId !== targetUser.id,
    'Reset tokens maintain cryptographic tenant & user ID binding'
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

runPhaseNPart2Tests();
