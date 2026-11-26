import 'dotenv/config';

let hasWarned = false;

export function validateStartupEnv(): void {
  const missingSecrets: string[] = [];

  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    missingSecrets.push('JWT_SECRET');
    process.env.JWT_SECRET = 'dev_jwt_secret_agentsguardian_2026_default';
  }

  if (!process.env.INTERNAL_SERVICE_SECRET || !process.env.INTERNAL_SERVICE_SECRET.trim()) {
    missingSecrets.push('INTERNAL_SERVICE_SECRET');
    process.env.INTERNAL_SERVICE_SECRET = 'dev_internal_service_secret_2026_default';
  }

  const hasFirebaseCreds = Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim()) ||
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS.trim())
  );

  const hasDbPass = (process.env.DB_PASS && process.env.DB_PASS.trim()) ||
                    (process.env.POSTGRES_PASSWORD && process.env.POSTGRES_PASSWORD.trim()) ||
                    (process.env.DATABASE_URL && process.env.DATABASE_URL.trim());

  if (!hasFirebaseCreds && process.env.ENABLE_POSTGRES !== 'true') {
    missingSecrets.push('FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY / GOOGLE_APPLICATION_CREDENTIALS)');
  } else if (process.env.ENABLE_POSTGRES === 'true' && !hasDbPass) {
    missingSecrets.push('DB_PASS (or POSTGRES_PASSWORD / DATABASE_URL)');
  }

  if (missingSecrets.length > 0 && !hasWarned) {
    hasWarned = true;
    if (process.env.STRICT_STARTUP_SECRETS === 'true') {
      console.error(`FATAL: Required environment variables/secrets are missing or empty:\n  - ${missingSecrets.join('\n  - ')}\nProcess exiting non-zero (exit code 1).`);
      process.exit(1);
    } else {
      console.warn(`[STARTUP_WARN] Missing or unconfigured environment variables/secrets:\n  - ${missingSecrets.join('\n  - ')}\nOperating with local development defaults / fallback storage engine.`);
    }
  }
}

