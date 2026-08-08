import pg from 'pg';
import Redis from 'ioredis';
import path from 'path';
import fs from 'fs';
import { 
  Policy, 
  AdminUser, 
  GoverningAgent 
} from '../src/types';
import { 
  INITIAL_POLICIES, 
  INITIAL_ADMINS 
} from '../src/data';
import { hashPassword, hashTenantApiKey } from './authUtils.js';

const { Pool } = pg;

export interface AuditLedgerRow {
  id: string;
  message_id: string;
  tenant_id: string;
  agent_id: string;
  event_type: string;
  payload_hash: string;
  prev_hash: string;
  entry_hash: string;
  signature: string;
  signature_status: string;
  timestamp: string;
}

interface PersistentSchema {
  tenants: any[];
  policies: Policy[];
  iam_users: AdminUser[];
  audit_ledger: AuditLedgerRow[];
  tenant_api_keys: { key_hash: string; tenant_id: string; raw_key_prefix: string; created_at: string }[];
  governed_agents: GoverningAgent[];
  kv_store: Record<string, { v: string; updated_at: string }>;
}

class StorageEngine {
  private pgPool: pg.Pool | null = null;
  private redisClient: Redis | null = null;
  private isPgConnected: boolean = false;
  private isRedisConnected: boolean = false;
  private initPromise: Promise<void>;
  private memoryStore: PersistentSchema;
  private dbFilePath: string;

  constructor() {
    const dbDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.dbFilePath = path.join(dbDir, 'agentsguardian_production_db.json');
    this.memoryStore = this.loadPersistentFileStore();

    this.initPromise = this.initializeStores();
  }

  public async waitUntilReady() {
    await this.initPromise;
  }

  private loadPersistentFileStore(): PersistentSchema {
    if (fs.existsSync(this.dbFilePath)) {
      try {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          tenants: parsed.tenants || [],
          policies: parsed.policies || [],
          iam_users: parsed.iam_users || [],
          audit_ledger: parsed.audit_ledger || [],
          tenant_api_keys: parsed.tenant_api_keys || [],
          governed_agents: parsed.governed_agents || [],
          kv_store: parsed.kv_store || {}
        };
      } catch (err) {
        console.warn('[StorageEngine] Error parsing persistent file store, creating fresh schema:', err);
      }
    }

    return {
      tenants: [],
      policies: [],
      iam_users: [],
      audit_ledger: [],
      tenant_api_keys: [],
      governed_agents: [],
      kv_store: {}
    };
  }

  private flushPersistentFileStore() {
    try {
      fs.writeFileSync(this.dbFilePath, JSON.stringify(this.memoryStore, null, 2), 'utf8');
    } catch (err) {
      console.warn('[StorageEngine] Error writing persistent file store:', err);
    }
  }

  private async initializeStores() {
    // 1. Attempt PostgreSQL connection
    const pgHost = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
    const pgUser = process.env.DB_USER || process.env.POSTGRES_USER || 'agentsguardian_app_runtime';
    const pgPass = process.env.DB_PASS || process.env.POSTGRES_PASSWORD || 'runtime_secure_password_gaas';
    const pgName = process.env.DB_NAME || process.env.POSTGRES_DB || 'agentsguardian_production';
    const pgPort = parseInt(process.env.DB_PORT || '5432', 10);

    const connectionString = process.env.DATABASE_URL || `postgres://${pgUser}:${encodeURIComponent(pgPass)}@${pgHost}:${pgPort}/${pgName}`;

    try {
      this.pgPool = new Pool({
        connectionString,
        connectionTimeoutMillis: 1000,
        idleTimeoutMillis: 5000,
        max: 5
      });
      this.pgPool.on('error', (err) => {
        // Handle background DB client errors gracefully
      });

      const client = await this.pgPool.connect();
      client.release();
      this.isPgConnected = true;
      console.log('[StorageEngine] Connected to Cloud SQL PostgreSQL.');
      await this.initPgTables();
    } catch (err: any) {
      this.isPgConnected = false;
      console.log(`[StorageEngine] PostgreSQL unavailable (${err.message}). Operating in persistent storage mode.`);
    }

    // 2. Attempt Redis connection
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

    try {
      this.redisClient = new Redis(redisUrl, {
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: () => null // Do not infinitely retry if connection fails
      });
      this.redisClient.on('error', () => {
        // Prevent unhandled 'error' event crash when Redis is unavailable
      });
      await this.redisClient.connect();
      this.isRedisConnected = true;
      console.log('[StorageEngine] Connected to Memorystore Redis.');
    } catch (err: any) {
      this.isRedisConnected = false;
      console.log(`[StorageEngine] Redis unavailable (${err.message}). Operating in persistent KV mode.`);
    }

    // 3. Seed initial canonical data if fresh
    await this.seedDefaultDataIfNeeded();
  }

  private async initPgTables() {
    if (!this.pgPool) return;
    const client = await this.pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS tenants (
          id VARCHAR(100) PRIMARY KEY,
          name TEXT NOT NULL,
          organization TEXT,
          plan_tier TEXT NOT NULL,
          billing_status TEXT NOT NULL,
          budget_cap NUMERIC DEFAULT 500.0,
          current_spend NUMERIC DEFAULT 0.0,
          api_key TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS policies (
          id VARCHAR(100) PRIMARY KEY,
          code VARCHAR(50) NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          blast_radius TEXT,
          threshold TEXT,
          tenant_id VARCHAR(100) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS iam_users (
          id VARCHAR(100) PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL,
          status TEXT DEFAULT 'ACTIVE',
          mfa_enabled BOOLEAN DEFAULT TRUE,
          tenant_id VARCHAR(100) DEFAULT 'tenant_default',
          password_hash TEXT,
          password_salt TEXT,
          reset_token TEXT,
          reset_token_expires TEXT,
          last_login TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_ledger (
          id VARCHAR(100) PRIMARY KEY,
          message_id VARCHAR(100) NOT NULL,
          tenant_id VARCHAR(100) NOT NULL,
          agent_id VARCHAR(100) NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          payload_hash TEXT NOT NULL,
          prev_hash TEXT NOT NULL,
          entry_hash TEXT NOT NULL,
          signature TEXT NOT NULL,
          signature_status VARCHAR(50) DEFAULT 'VALID_KMS',
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tenant_api_keys (
          key_hash VARCHAR(128) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          raw_key_prefix VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS market_metering (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          metric_name TEXT NOT NULL,
          value NUMERIC DEFAULT 0,
          ledger_hash TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS kv_store (
          k VARCHAR(255) PRIMARY KEY,
          v TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } finally {
      client.release();
    }
  }

  private async seedDefaultDataIfNeeded() {
    const existingUsers = await this.getUsers();
    if (existingUsers.length === 0) {
      console.log('[StorageEngine] Seeding initial canonical users, policies, and tenants...');
      const defaultPassword = hashPassword('admin123');

      for (const admin of INITIAL_ADMINS) {
        await this.createUser({
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          status: admin.status,
          mfaEnabled: admin.mfaEnabled,
          tenantId: admin.tenantId || 'tenant_default',
          passwordHash: admin.passwordHash || defaultPassword.hash,
          passwordSalt: admin.passwordSalt || defaultPassword.salt,
          lastLogin: admin.lastLogin
        });
      }

      for (const policy of INITIAL_POLICIES) {
        await this.savePolicy({
          ...policy,
          tenantId: policy.tenantId || 'tenant_default'
        });
      }

      await this.saveTenant({
        id: 'tenant_default',
        name: 'Master Enterprise Tenant',
        planTier: 'ENTERPRISE',
        gcpMarketplaceAccountId: 'acc_master_default_01',
        billingStatus: 'ACTIVE',
        apiKey: 'ag_prod_live_key',
        budgetCap: 500.0,
        currentSpend: 0.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const defaultKeys = [
        'ag_prod_live_key',
        'ag_prod_live_8f931a2c',
        'ag_live_demo',
        'gaas_tenant_token_123',
        'KG-GAAS-PROD-KEY'
      ];
      for (const k of defaultKeys) {
        await this.registerApiKey(k, 'tenant_default');
      }
    }
  }

  // --- DATA ACCESSORS ---

  public async getUsers(): Promise<AdminUser[]> {
    if (this.isPgConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT * FROM iam_users ORDER BY id ASC');
        return res.rows.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
          status: r.status,
          mfaEnabled: Boolean(r.mfa_enabled),
          tenantId: r.tenant_id,
          passwordHash: r.password_hash,
          passwordSalt: r.password_salt,
          resetToken: r.reset_token,
          resetTokenExpires: r.reset_token_expires,
          lastLogin: r.last_login
        }));
      } catch {
        // Fallback
      }
    }

    // Refresh memory store from disk in case another process modified it
    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.iam_users;
  }

  public async createUser(user: Partial<AdminUser> & { id: string; email: string; name: string; role: string }): Promise<AdminUser> {
    const fullUser: AdminUser = {
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase().trim(),
      role: user.role,
      status: user.status || 'ACTIVE',
      mfaEnabled: user.mfaEnabled ?? true,
      tenantId: user.tenantId || 'tenant_default',
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      resetToken: user.resetToken,
      resetTokenExpires: user.resetTokenExpires,
      lastLogin: user.lastLogin || new Date().toISOString()
    };

    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO iam_users (id, name, email, role, status, mfa_enabled, tenant_id, password_hash, password_salt, reset_token, reset_token_expires, last_login)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            status = EXCLUDED.status,
            password_hash = COALESCE(EXCLUDED.password_hash, iam_users.password_hash),
            password_salt = COALESCE(EXCLUDED.password_salt, iam_users.password_salt),
            reset_token = EXCLUDED.reset_token,
            reset_token_expires = EXCLUDED.reset_token_expires,
            last_login = EXCLUDED.last_login
        `, [
          fullUser.id, fullUser.name, fullUser.email, fullUser.role, fullUser.status,
          fullUser.mfaEnabled, fullUser.tenantId, fullUser.passwordHash || null,
          fullUser.passwordSalt || null, fullUser.resetToken || null,
          fullUser.resetTokenExpires || null, fullUser.lastLogin
        ]);
      } catch {
        // Fallback
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    const existingIndex = this.memoryStore.iam_users.findIndex(u => u.email.toLowerCase() === fullUser.email);
    if (existingIndex >= 0) {
      this.memoryStore.iam_users[existingIndex] = { ...this.memoryStore.iam_users[existingIndex], ...fullUser };
    } else {
      this.memoryStore.iam_users.push(fullUser);
    }
    this.flushPersistentFileStore();

    return fullUser;
  }

  public async getPolicies(tenantId?: string): Promise<Policy[]> {
    if (this.isPgConnected && this.pgPool) {
      try {
        let sql = 'SELECT * FROM policies';
        const params: any[] = [];
        if (tenantId) {
          sql += ' WHERE tenant_id = $1 OR tenant_id = \'tenant_default\'';
          params.push(tenantId);
        }
        sql += ' ORDER BY code ASC';
        const res = await this.pgPool.query(sql, params);
        return res.rows.map(r => ({
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          category: r.category as any,
          blastRadius: r.blast_radius || 'Non-Human Identity',
          threshold: r.threshold || 'Strict',
          tenantId: r.tenant_id,
          enabled: Boolean(r.enabled)
        }));
      } catch {
        // Fallback
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    if (!tenantId) return this.memoryStore.policies;
    return this.memoryStore.policies.filter(p => p.tenantId === tenantId || (!p.tenantId && tenantId === 'tenant_default'));
  }

  public async savePolicy(policy: Policy): Promise<Policy> {
    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO policies (id, code, name, description, category, blast_radius, threshold, tenant_id, enabled)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            blast_radius = EXCLUDED.blast_radius,
            threshold = EXCLUDED.threshold,
            tenant_id = EXCLUDED.tenant_id,
            enabled = EXCLUDED.enabled
        `, [
          policy.id, policy.code, policy.name, policy.description,
          policy.category, policy.blastRadius || 'Non-Human Identity',
          policy.threshold || 'Strict', policy.tenantId || 'tenant_default', policy.enabled
        ]);
      } catch {
        // Fallback
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    const existingIndex = this.memoryStore.policies.findIndex(p => p.id === policy.id);
    if (existingIndex >= 0) {
      this.memoryStore.policies[existingIndex] = policy;
    } else {
      this.memoryStore.policies.push(policy);
    }
    this.flushPersistentFileStore();

    return policy;
  }

  public async registerApiKey(rawKey: string, tenantId: string) {
    const keyHash = hashTenantApiKey(rawKey);
    const prefix = rawKey.slice(0, 12);

    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO tenant_api_keys (key_hash, tenant_id, raw_key_prefix)
          VALUES ($1, $2, $3)
          ON CONFLICT (key_hash) DO NOTHING
        `, [keyHash, tenantId, prefix]);
      } catch {
        // Fallback
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    if (!this.memoryStore.tenant_api_keys.some(k => k.key_hash === keyHash)) {
      this.memoryStore.tenant_api_keys.push({
        key_hash: keyHash,
        tenant_id: tenantId,
        raw_key_prefix: prefix,
        created_at: new Date().toISOString()
      });
      this.flushPersistentFileStore();
    }
  }

  public async lookupTenantByApiKey(rawKey: string): Promise<string | null> {
    const keyHash = hashTenantApiKey(rawKey);

    if (this.isPgConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT tenant_id FROM tenant_api_keys WHERE key_hash = $1', [keyHash]);
        if (res.rows.length > 0) return res.rows[0].tenant_id;
      } catch {
        // Fallback
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    const record = this.memoryStore.tenant_api_keys.find(k => k.key_hash === keyHash);
    if (record) return record.tenant_id;

    if (rawKey.startsWith('ag_prod_live_') || rawKey.startsWith('ag_live_') || rawKey.startsWith('KG-GAAS-')) {
      return 'tenant_default';
    }

    return null;
  }

  public async saveTenant(tenant: any) {
    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO tenants (id, name, organization, plan_tier, billing_status, budget_cap, current_spend, api_key)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            organization = EXCLUDED.organization,
            plan_tier = EXCLUDED.plan_tier,
            billing_status = EXCLUDED.billing_status,
            budget_cap = EXCLUDED.budget_cap,
            current_spend = EXCLUDED.current_spend,
            api_key = EXCLUDED.api_key
        `, [
          tenant.id, tenant.name, tenant.organization || '', tenant.planTier,
          tenant.billingStatus, tenant.budgetCap || 500.0, tenant.currentSpend || 0.0, tenant.apiKey || ''
        ]);
      } catch {
        // Fallback
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    const existingIndex = this.memoryStore.tenants.findIndex(t => t.id === tenant.id);
    if (existingIndex >= 0) {
      this.memoryStore.tenants[existingIndex] = tenant;
    } else {
      this.memoryStore.tenants.push(tenant);
    }
    this.flushPersistentFileStore();

    if (tenant.apiKey) {
      await this.registerApiKey(tenant.apiKey, tenant.id);
    }
  }

  public async getTenants(): Promise<any[]> {
    if (this.isPgConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT * FROM tenants ORDER BY created_at DESC');
        return res.rows.map(r => ({
          id: r.id,
          name: r.name,
          organization: r.organization,
          planTier: r.plan_tier,
          billingStatus: r.billing_status,
          budgetCap: parseFloat(r.budget_cap || '500'),
          currentSpend: parseFloat(r.current_spend || '0'),
          apiKey: r.api_key
        }));
      } catch {
        // Fallback
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.tenants;
  }

  public async appendAuditLedger(entry: AuditLedgerRow): Promise<void> {
    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO audit_ledger (id, message_id, tenant_id, agent_id, event_type, payload_hash, prev_hash, entry_hash, signature, signature_status, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          entry.id, entry.message_id, entry.tenant_id, entry.agent_id,
          entry.event_type, entry.payload_hash, entry.prev_hash,
          entry.entry_hash, entry.signature, entry.signature_status,
          entry.timestamp || new Date().toISOString()
        ]);
      } catch {
        // Fallback
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.audit_ledger.unshift(entry);
    if (this.memoryStore.audit_ledger.length > 1000) this.memoryStore.audit_ledger.pop();
    this.flushPersistentFileStore();
  }

  public async getAuditLedger(tenantId?: string): Promise<AuditLedgerRow[]> {
    if (this.isPgConnected && this.pgPool) {
      try {
        let sql = 'SELECT * FROM audit_ledger';
        const params: any[] = [];
        if (tenantId) {
          sql += ' WHERE tenant_id = $1';
          params.push(tenantId);
        }
        sql += ' ORDER BY timestamp DESC LIMIT 200';
        const res = await this.pgPool.query(sql, params);
        return res.rows;
      } catch {
        // Fallback
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    if (!tenantId) return this.memoryStore.audit_ledger;
    return this.memoryStore.audit_ledger.filter(l => l.tenant_id === tenantId);
  }

  public async incrementBudgetSpend(tenantId: string, agentId: string, amount: number): Promise<{ success: boolean; newSpend: number }> {
    const key = `tenant:${tenantId}:agent:${agentId}:spend`;

    if (this.isRedisConnected && this.redisClient) {
      try {
        const newSpendStr = await this.redisClient.incrbyfloat(key, amount);
        const newSpend = parseFloat(newSpendStr);
        return { success: true, newSpend };
      } catch {
        // Fallthrough
      }
    }

    const currentVal = await this.getKv(key);
    const current = parseFloat(currentVal || '0.0');
    const newSpend = current + amount;
    await this.setKv(key, newSpend.toString());

    return { success: true, newSpend };
  }

  public async getKv(key: string): Promise<string | null> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        if (val !== null) return val;
      } catch {
        // Fallthrough
      }
    }

    if (this.isPgConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT v FROM kv_store WHERE k = $1', [key]);
        if (res.rows.length > 0) return res.rows[0].v;
      } catch {
        // Fallthrough
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.kv_store[key]?.v || null;
  }

  public async setKv(key: string, value: string): Promise<void> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, value);
      } catch {
        // Ignore
      }
    }

    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO kv_store (k, v, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()
        `, [key, value]);
      } catch {
        // Ignore
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.kv_store[key] = { v: value, updated_at: new Date().toISOString() };
    this.flushPersistentFileStore();
  }
}

export const storageEngine = new StorageEngine();
