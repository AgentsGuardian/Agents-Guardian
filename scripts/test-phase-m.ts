import fs from 'fs';
import path from 'path';

/**
 * Phase M Regression Test Suite:
 * Verify Client-Side "Google SSO" Simulation Removal & Strict Auth Pathways:
 *  1. GaaSAccessGate.tsx contains no Google SSO presets, mock bypass buttons, or simulated modals
 *  2. index.css contains no orphaned Google SSO selector overrides
 *  3. HelpCenter.tsx contains no obsolete Google SSO walkthroughs
 *  4. Authentication is strictly bounded to verified server-side endpoints (/api/auth/login, /api/auth/register, etc.)
 */

function runPhaseMTests() {
  console.log('================================================================');
  console.log('PHASE M — REMOVAL OF CLIENT-SIDE "GOOGLE SSO" SIMULATION TEST SUITE');
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

  // 1. Check GaaSAccessGate.tsx
  const accessGatePath = path.join(process.cwd(), 'src/components/GaaSAccessGate.tsx');
  const accessGateContent = fs.readFileSync(accessGatePath, 'utf8');

  assert(
    !accessGateContent.includes('PRESET_GOOGLE_ACCOUNTS'),
    'GaaSAccessGate.tsx must not contain PRESET_GOOGLE_ACCOUNTS array'
  );
  assert(
    !accessGateContent.includes('google-id-bypass-btn'),
    'GaaSAccessGate.tsx must not render google-id-bypass-btn'
  );
  assert(
    !accessGateContent.includes('google-id-register-btn'),
    'GaaSAccessGate.tsx must not render google-id-register-btn'
  );
  assert(
    !accessGateContent.includes('google-sso-modal'),
    'GaaSAccessGate.tsx must not render google-sso-modal'
  );
  assert(
    !accessGateContent.includes('Google SSO Registered'),
    'GaaSAccessGate.tsx must not assign "Google SSO Registered" status bypasses'
  );
  assert(
    !accessGateContent.includes('googleSsoEmail'),
    'GaaSAccessGate.tsx must not contain googleSso state hooks'
  );
  assert(
    accessGateContent.includes('handleFormSubmit'),
    'GaaSAccessGate.tsx retains canonical form submission handler'
  );

  // 2. Check index.css
  const indexCssPath = path.join(process.cwd(), 'src/index.css');
  const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

  assert(
    !indexCssContent.includes('google-id-federated-bypass-container'),
    'index.css must not contain #google-id-federated-bypass-container'
  );
  assert(
    !indexCssContent.includes('google-id-federated-register-container'),
    'index.css must not contain #google-id-federated-register-container'
  );

  // 3. Check HelpCenter.tsx
  const helpCenterPath = path.join(process.cwd(), 'src/components/HelpCenter.tsx');
  const helpCenterContent = fs.readFileSync(helpCenterPath, 'utf8');

  assert(
    !helpCenterContent.includes('google-sso-registration-flow'),
    'HelpCenter.tsx must not contain google-sso-registration-flow guide item'
  );

  // 4. Verify no client bypasses in App.tsx or authentication callers
  const appPath = path.join(process.cwd(), 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert(
    !appContent.includes('bypassGoogleAuth'),
    'App.tsx contains no unauthenticated Google bypass logic'
  );

  console.log('\n----------------------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhaseMTests();
