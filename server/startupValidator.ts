import 'dotenv/config';

export function validateStartupEnv(): void {
  const missingSecrets: string[] = [];

  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    missingSecrets.push('JWT_SECRET');
  }

  if (!process.env.INTERNAL_SERVICE_SECRET || !process.env.INTERNAL_SERVICE_SECRET.trim()) {
    missingSecrets.push('INTERNAL_SERVICE_SECRET');
  }

  const hasDbPass = (process.env.DB_PASS && process.env.DB_PASS.trim()) ||
                    (process.env.POSTGRES_PASSWORD && process.env.POSTGRES_PASSWORD.trim()) ||
                    (process.env.DATABASE_URL && process.env.DATABASE_URL.trim());

  if (!hasDbPass) {
    missingSecrets.push('DB_PASS (or POSTGRES_PASSWORD / DATABASE_URL)');
  }

  if (missingSecrets.length > 0) {
    console.error(`FATAL: Required environment variables/secrets are missing or empty:\n  - ${missingSecrets.join('\n  - ')}\nProcess exiting non-zero (exit code 1).`);
    process.exit(1);
  }
}
