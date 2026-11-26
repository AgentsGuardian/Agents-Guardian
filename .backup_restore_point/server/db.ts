import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { 
  Policy, 
  AdminUser, 
  GoverningAgent,
  KillSignalEvent,
  DriftLogEvent,
  ValueMeterMetric,
  ApiRequestLog,
  LaborConfig,
  GlobalAdminSettings,
  TenantFailureModeConfig
} from '../src/types';
import { 
  INITIAL_POLICIES, 
  INITIAL_ADMINS,
  INITIAL_KILL_SWITCH_EVENTS,
  INITIAL_DRIFT_EVENTS,
  INITIAL_VALUE_METRICS,
  INITIAL_GOVERNED_AGENTS
} from '../src/data';
import { hashPassword, hashTenantApiKey } from './authUtils.js';

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

export interface PolicyVersionRecord {
  versionId: string;
  policyId: string;
  tenantId: string;
  code: string;
  snapshot: Policy;
  changedBy: string;
  timestamp: string;
}

export interface GlobalConfigDocument {
  laborConfig: LaborConfig;
  budgetCap: number;
  governanceMode: 'setup' | 'active';
  globalSettings: GlobalAdminSettings;
  tenantFailureConfig: TenantFailureModeConfig;
  updatedAt: string;
}

interface PersistentSchema {
  tenants: any[];
  policies: Policy[];
  policy_versions?: PolicyVersionRecord[];
  iam_users: AdminUser[];
  audit_ledger: AuditLedgerRow[];
  tenant_api_keys: { key_hash: string; tenant_id: string; raw_key_prefix: string; created_at: string }[];
  governed_agents: GoverningAgent[];
  kill_events?: KillSignalEvent[];
  drift_events?: DriftLogEvent[];
  api_logs?: ApiRequestLog[];
  notifications?: any[];
  value_metrics?: ValueMeterMetric[];
  global_config?: GlobalConfigDocument;
  kv_store: Record<string, { v: string; updated_at: string }>;
}

// Retention caps for high-frequency telemetry collections
const RETENTION_LIMITS = {
  API_LOGS: 250,
  NOTIFICATIONS: 100,
  VALUE_METRICS: 90,
  KILL_EVENTS: 200,
  DRIFT_EVENTS: 200
};

class StorageEngine {
  private firestoreDb: Firestore | null = null;
  private isFirestoreConnected: boolean = false;
  private degraded: boolean = false;
  private degradedReason: string = '';
  private initPromise: Promise<void>;
  private memoryStore: PersistentSchema;
  private dbFilePath: string;

  // In-memory rate limiting window map (key -> { count, resetAt })
  private rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

  public getHealthStatus(): {
    degraded: boolean;
    reason: string;
    isFirestoreConnected: boolean;
  } {
    return {
      degraded: this.degraded,
      reason: this.degradedReason,
      isFirestoreConnected: this.isFirestoreConnected
    };
  }

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
          policy_versions: parsed.policy_versions || [],
          iam_users: parsed.iam_users || [],
          audit_ledger: parsed.audit_ledger || [],
          tenant_api_keys: parsed.tenant_api_keys || [],
          governed_agents: parsed.governed_agents || [],
          kill_events: parsed.kill_events || [...INITIAL_KILL_SWITCH_EVENTS],
          drift_events: (parsed.drift_events || []).filter((e: any) => e.id !== 'DFT-301' && e.id !== 'DFT-304' && e.id !== 'DFT-202'),
          api_logs: parsed.api_logs || [],
          notifications: parsed.notifications || [],
          value_metrics: parsed.value_metrics || [...INITIAL_VALUE_METRICS],
          global_config: parsed.global_config || undefined,
          kv_store: parsed.kv_store || {}
        };
      } catch (err) {
        console.warn('[StorageEngine] Error parsing persistent file store, creating fresh schema:', err);
      }
    }

    return {
      tenants: [],
      policies: [],
      policy_versions: [],
      iam_users: [],
      audit_ledger: [],
      tenant_api_keys: [],
      governed_agents: [],
      kill_events: [...INITIAL_KILL_SWITCH_EVENTS],
      drift_events: [],
      api_logs: [],
      notifications: [],
      value_metrics: [...INITIAL_VALUE_METRICS],
      global_config: undefined,
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

  private onSyncCallback: ((collection: string, data: any) => void) | null = null;

  public setOnSyncCallback(cb: (collection: string, data: any) => void) {
    this.onSyncCallback = cb;
  }

  /**
   * Initializes Cloud Firestore as the primary database (`agents-guardian`, `default`).
   * Falls back to local persistent storage (`.data/agentsguardian_production_db.json`) if Firestore is unreachable.
   */
  private async initializeStores() {
    let firestoreFailed = false;
    let firestoreErrMsg = '';

    const requirePersistent = process.env.REQUIRE_PERSISTENT_STORAGE === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.STRICT_STORAGE === 'true');

    const projectId = 'agents-guardian';
    const databaseId = 'default';
    const region = 'nam5';

    const fallbackSa = {
      "type": "service_account",
      "project_id": "agents-guardian",
      "private_key_id": "6b8da6d186ee38ac3b45f32a51949a7581fb9336",
      "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3P4BpmqDsTXqW\n9LyTPIND4M7T33FkyIP18YJi663K9p9IAoKh08gILZySnp1dsjd8+s6/QM6nvmNp\nWSJK4PD+RiU5kfo4TVj8eEHhU+Uctp0J3D8T/TCjeY+CZ2afqsG8HRmadxFPdVVb\n1cenfpZkaJNYAUDkpsCe2Roent5ov9rCsuxEWB8DfegY1vXXy9pFxES9eKBQ27W1\n9GeFu4GSm6/Y1MplB6gCUx3yO2vYihdHRoPqE/w18J2ZfBwDO9yE5BmVJQBZ7/zG\n+8t1t8a1AyIHNKc0IVpjQ2C+naUb6TCNHM+7BnL2LbmvmHTG/kj+yNxMeknS6FKJ\n6T4BetFTAgMBAAECggEAG/+uYbRYITLnZ7hGNeL5lX38bCAIZeNDUmlPyEiFWe0b\nwjdr+UjwF9vMQBTPK5lG5Cg4Pb2rtbKf4uFVHYbIG7nhBy5YQpEC5zSCsGiOqbf3\nP6Hw21+Etn2k4UJmSkAfcNwrZNALi438eFcuNdfgJ8BYvwoV/bnC1aKLXKFejzd6\ntxRmcyS4dXojFGWotXm8FBebMy37ibYyXDKILVYaQQJHmoqQ42H0AgOdjHgo3/tH\nKhO5TyDz8hNYd8ILnEVro0UDXYMun95EqRzEYb1pE5xHYknoQ2Og3yttmZVhM+yY\nk7IpHWayssEkUbJwIjemZUnlrnyJ1smXOxkXTL1i4QKBgQDuzeG1Z0/5OXCLB1kl\U4cGbv4Ao40sTFgTcnPtBt5HD5R1W2sKwCMmnGVzJLPADFdrIx1WLwK/330AZW/s\nC4b74emo4luvGqIZiwusQRY5FPxMt/YI51xrDnbxCyWKe/8wwvRBkNh0ktkg8tJX\njHWtQxLEL75KhaCeBNEzdWpvoQKBgQDEcX9GszpXw8X+/IjRWBfX+OMLmB59N1ui\ngl7CxcaTQnLu2KBbuQRF/BwUaWW8pEYFkrIzJD/0aJHySFik8npFXBtdePS/5/zy\UiFzXfNAnw8UCGHlvCx0pcuPaixls+YMnbgzKa+Ya9kMrlXpXXYsN9mN5Tnfl6Oc\n1CJYwZsscwKBgQCrfCD3OYdOexb8X3x+t2qhDhdMsiXwh6o/3NKuhV4dPWzokYte\nnvcfBPQ9KUADS1mDUCYC+6NH0d9b53vlz6lRO7ulUVdxePiqyxTIz7x7pTxAg2Ik\npq/RGQQEuHJu7fglNfpdEvy9Sa6uYHD3+Z+PmjjhtT87GJZsoxzvjQOvwQKBgDrn\GVXWugDE+CKMEG5NLuEYhOPeGg5LwhNJaiaW7QMM4q+RjwvRv2FIxhasv8+/pitX\noE1Lak3b6R8v6DyVZGpVwvLVKPY+Fo+GZvdTzXOr/fZwyQH82YukhxQarvNT7QAN\nbsUQk9FtTSjLQYF2/88kc/xjJmZP7sRAq4fXjbLXAoGBAM2cmfCP7PO8ek1fauDu\nqN5vYQG6AQzhv8/1VPPD+zO9J2EeVhI6EUMTz3WgNqGQ3t7cqGaBgegNTYH5TlYU\nsRm/RyxWwIfksXhiY1VPA74Do7jFLBsE1FlzEZGrGlVnFzLb1IrPW5/n6Gg3SMb\nIrnfD8Lk2H3NV2nlMVqd52qJ\n-----END PRIVATE KEY-----\n",
      "client_email": "firebase-adminsdk-fbsvc@agents-guardian.iam.gserviceaccount.com",
      "client_id": "105195869590972487666",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40agents-guardian.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    };

    let sa = fallbackSa;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim()) {
      try {
        sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch (e) {
        console.warn('[StorageEngine] Failed to parse custom FIREBASE_SERVICE_ACCOUNT_JSON, using embedded fallback credentials:', e);
      }
    }

    try {
      let app: App;
      const existingApps = getApps();
      if (existingApps.length > 0) {
        app = existingApps[0];
      } else {
        app = initializeApp({
          credential: cert(sa as any),
          projectId: sa.project_id || projectId
        });
      }

      let resolvedDbId = databaseId;
      let fsInstance = resolvedDbId === '(default)' ? getFirestore(app) : getFirestore(app, resolvedDbId);
      try {
        fsInstance.settings({ ignoreUndefinedProperties: true });
      } catch {
        // Settings already locked on existing Firestore instance
      }

      // Connectivity probe with 10s timeout; if '(default)' returns 5 NOT_FOUND, automatically try named database 'default'
      try {
        await Promise.race([
          fsInstance.collection('system_state').doc('health_probe').get(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore connectivity check timed out after 10000ms')), 10000))
        ]);
      } catch (probeErr: any) {
        const isNotFound = probeErr?.code === 5 || String(probeErr?.message || '').includes('NOT_FOUND');
        if (isNotFound && (resolvedDbId === '(default)' || resolvedDbId === 'default')) {
          const altDbId = resolvedDbId === '(default)' ? 'default' : '(default)';
          const altInstance = altDbId === '(default)' ? getFirestore(app) : getFirestore(app, altDbId);
          try {
            altInstance.settings({ ignoreUndefinedProperties: true });
          } catch {
            // Settings already locked
          }
          await Promise.race([
            altInstance.collection('system_state').doc('health_probe').get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore connectivity check timed out after 10000ms')), 10000))
          ]);
          fsInstance = altInstance;
          resolvedDbId = altDbId;
        } else {
          throw probeErr;
        }
      }

      this.firestoreDb = fsInstance;
      this.isFirestoreConnected = true;
      console.log(`[StorageEngine] Connected to Cloud Firestore (projectId: ${projectId}, databaseId: ${resolvedDbId}, region: ${region}).`);
      
      // Activate real-time Firestore listeners for instant bi-directional updates
      this.setupRealtimeListeners();
    } catch (err: any) {
      this.isFirestoreConnected = false;
      this.firestoreDb = null;
      firestoreFailed = true;
      firestoreErrMsg = err.message || 'Cloud Firestore connection failed';
      console.warn(`[StorageEngine] WARNING: Cloud Firestore (${projectId}/${databaseId}) unreachable: ${firestoreErrMsg}. Falling back to local persistent store.`);
    }

    if (firestoreFailed && requirePersistent) {
      this.degraded = true;
      this.degradedReason = firestoreErrMsg;
      console.error(`[STORAGE_FATAL] REQUIRE_PERSISTENT_STORAGE is enabled and Cloud Firestore is unreachable (${firestoreErrMsg}). Process exiting non-zero.`);
      process.exit(1);
    }

    // Seed initial canonical data if fresh
    await this.seedDefaultDataIfNeeded();
  }

  private setupRealtimeListeners() {
    if (!this.isFirestoreConnected || !this.firestoreDb) return;

    try {
      // 1. Real-time sync for Governed Agents
      this.firestoreDb.collection('governed_agents').onSnapshot(snap => {
        if (snap && snap.docs) {
          const agents = snap.docs.map(d => d.data() as GoverningAgent);
          this.memoryStore.governed_agents = agents;
          this.flushPersistentFileStore();
          if (this.onSyncCallback) this.onSyncCallback('governed_agents', agents);
        }
      }, err => console.warn('[StorageEngine:Realtime] governed_agents listener warning:', err?.message || err));

      // 2. Real-time sync for IAM Users
      this.firestoreDb.collection('iam_users').onSnapshot(snap => {
        if (snap && snap.docs) {
          const users = snap.docs.map(d => d.data() as AdminUser);
          this.memoryStore.iam_users = users;
          this.flushPersistentFileStore();
          if (this.onSyncCallback) this.onSyncCallback('iam_users', users);
        }
      }, err => console.warn('[StorageEngine:Realtime] iam_users listener warning:', err?.message || err));

      // 3. Real-time sync for Policies
      this.firestoreDb.collection('policies').onSnapshot(snap => {
        if (snap && snap.docs) {
          const policies = snap.docs.map(d => d.data() as Policy);
          this.memoryStore.policies = policies;
          this.flushPersistentFileStore();
          if (this.onSyncCallback) this.onSyncCallback('policies', policies);
        }
      }, err => console.warn('[StorageEngine:Realtime] policies listener warning:', err?.message || err));

      // 4. Real-time sync for Global Config (laborConfig, budgetCap, governanceMode)
      this.firestoreDb.collection('global_config').doc('global_settings').onSnapshot(snap => {
        if (snap && snap.exists) {
          const config = snap.data();
          if (config) {
            this.memoryStore.global_config = config as any;
            this.flushPersistentFileStore();
            if (this.onSyncCallback) this.onSyncCallback('global_config', config);
          }
        }
      }, err => console.warn('[StorageEngine:Realtime] global_config listener warning:', err?.message || err));

      console.log('[StorageEngine:Realtime] Firestore listeners active for governed_agents, iam_users, policies, and global_config.');
    } catch (err: any) {
      console.warn('[StorageEngine:Realtime] Error attaching Firestore listeners:', err?.message || err);
    }
  }

  private async seedDefaultDataIfNeeded() {
    const existingUsers = await this.getUsers();
    if (existingUsers.length === 0) {
      console.log('[StorageEngine] Seeding initial canonical users, policies, and tenants to Firestore...');

      for (const adminUser of INITIAL_ADMINS) {
        let userHash = adminUser.passwordHash;
        let userSalt = adminUser.passwordSalt;
        let mustReset = false;

        if (!userHash || !userSalt) {
          const seedPass = process.env.ADMIN_INITIAL_PASSWORD || 'Admin123!';
          const hashed = hashPassword(seedPass, 'c94d6e09811e26c3f02a5a8ae47945ff');
          userHash = hashed.hash;
          userSalt = hashed.salt;
          mustReset = false;
        }

        await this.createUser({
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          status: adminUser.status,
          mfaEnabled: adminUser.mfaEnabled,
          tenantId: adminUser.tenantId || 'tenant_default',
          passwordHash: userHash,
          passwordSalt: userSalt,
          lastLogin: adminUser.lastLogin,
          mustResetPassword: mustReset
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
        apiKey: '',
        budgetCap: 500.0,
        currentSpend: 0.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const agentsToSeed = INITIAL_GOVERNED_AGENTS.map(a => ({ ...a, tenantId: a.tenantId || 'tenant_default' }));
      await this.saveGovernedAgentsBatch(agentsToSeed);
    }

    // Explicitly guarantee POL-WEB-01 is registered in Firestore policies collection
    try {
      const allPolicies = await this.getPolicies();
      const hasPolWeb01 = allPolicies.some(p => p.code === 'POL-WEB-01' || p.id === 'POL-WEB-01');
      if (!hasPolWeb01) {
        console.log('[StorageEngine] Registering POL-WEB-01 "Destructive or Sensitive Web Actions" in Firestore...');
        const polWeb01 = INITIAL_POLICIES.find(p => p.code === 'POL-WEB-01') || {
          id: 'POL-WEB-01',
          code: 'POL-WEB-01',
          name: 'Destructive or Sensitive Web Actions',
          description: 'Intercept and halt AI agent browser actions (web_click, web_type, web_goto) that are irreversible or sensitive: deleting/clearing items, deleting accounts, placing orders/payments (Buy Now, checkout), password changes, or typing sensitive personal data (SSN, Aadhaar, passport, card/bank numbers, passwords).',
          category: 'security',
          blastRadius: 'Browser Agent (Web Action)',
          threshold: 'Zero-Trust (Strict Halt)',
          enabled: true,
          failureMode: 'FAIL_CLOSED',
          tenantId: 'tenant_default'
        };
        await this.savePolicy({
          ...polWeb01,
          tenantId: polWeb01.tenantId || 'tenant_default'
        });
      }
    } catch (err) {
      console.warn('[StorageEngine] Warning ensuring POL-WEB-01 in Firestore:', err);
    }
  }

  private async enforceCollectionRetention(collectionName: string, maxDocs: number, orderByField: string = 'timestamp') {
    if (!this.isFirestoreConnected || !this.firestoreDb) return;
    try {
      const snapshot = await this.firestoreDb
        .collection(collectionName)
        .orderBy(orderByField, 'desc')
        .offset(maxDocs)
        .limit(100)
        .get();

      if (!snapshot.empty) {
        const batch = this.firestoreDb.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn(`[StorageEngine] Retention prune warning for ${collectionName}:`, err);
    }
  }

  // ===========================================================================
  // CORE DATA ACCESSORS (FIRESTORE PRIMARY -> LOCAL FALLBACK)
  // ===========================================================================

  public async getUsers(): Promise<AdminUser[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb.collection('iam_users').orderBy('id', 'asc').get();
        return snap.docs.map(d => d.data() as AdminUser);
      } catch (err) {
        console.warn('[StorageEngine] Firestore getUsers error, falling back:', err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.iam_users;
  }

  public async createUser(user: Partial<AdminUser> & { id: string; email: string; name: string; role: string }): Promise<AdminUser> {
    const fullUser: AdminUser = {
      ...user,
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase().trim(),
      role: user.role as any,
      status: user.status || 'ACTIVE',
      mfaEnabled: user.mfaEnabled ?? true,
      tenantId: user.tenantId || 'tenant_default',
      passwordHash: user.passwordHash || '',
      passwordSalt: user.passwordSalt || '',
      resetToken: user.resetToken || '',
      resetTokenExpires: user.resetTokenExpires || '',
      lastLogin: user.lastLogin || new Date().toISOString(),
      mustResetPassword: user.mustResetPassword ?? false,
      organization: (user as any).organization || '',
      registrationNotes: (user as any).registrationNotes || '',
      registeredAt: (user as any).registeredAt || '',
      oneTimePassword: (user as any).oneTimePassword || '',
      oneTimePasswordIssuedAt: (user as any).oneTimePasswordIssuedAt || '',
      registeredPasswordHash: (user as any).registeredPasswordHash || '',
      registeredPasswordSalt: (user as any).registeredPasswordSalt || '',
      registeredPasswordPlain: (user as any).registeredPasswordPlain || ''
    };

    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('iam_users').doc(fullUser.id).set(fullUser, { merge: true });
        console.log(`[StorageEngine:Firestore] Successfully saved user: ${fullUser.id} (${fullUser.email})`);
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed saving user ${fullUser.id}:`, err?.message || err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    const existingIndex = this.memoryStore.iam_users.findIndex(u => u.email.toLowerCase() === fullUser.email || u.id === fullUser.id);
    if (existingIndex >= 0) {
      this.memoryStore.iam_users[existingIndex] = { ...this.memoryStore.iam_users[existingIndex], ...fullUser };
    } else {
      this.memoryStore.iam_users.push(fullUser);
    }
    this.flushPersistentFileStore();

    return fullUser;
  }

  public async deleteUser(userId: string): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('iam_users').doc(userId).delete();
        console.log(`[StorageEngine:Firestore] Successfully deleted user: ${userId}`);
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed deleting user ${userId}:`, err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.iam_users = this.memoryStore.iam_users.filter(u => u.id !== userId);
    this.flushPersistentFileStore();
  }

  public async getPolicies(tenantId?: string): Promise<Policy[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb.collection('policies').orderBy('code', 'asc').get();
        const all = snap.docs.map(d => d.data() as Policy);
        if (!tenantId) return all;
        return all.filter(p => p.tenantId === tenantId || p.tenantId === 'tenant_default' || (!p.tenantId && tenantId === 'tenant_default'));
      } catch (err) {
        console.warn('[StorageEngine] Firestore getPolicies error, falling back:', err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    if (!tenantId) return this.memoryStore.policies;
    return this.memoryStore.policies.filter(p => p.tenantId === tenantId || (!p.tenantId && tenantId === 'tenant_default'));
  }

  public async savePolicy(policy: Policy, changedBy: string = 'system'): Promise<Policy> {
    const normalizedPolicy: Policy = {
      ...policy,
      blastRadius: policy.blastRadius || 'Non-Human Identity',
      threshold: policy.threshold || 'Strict',
      tenantId: policy.tenantId || 'tenant_default'
    };

    const nowIso = new Date().toISOString();
    const versionHash = crypto
      .createHash('sha256')
      .update(`${normalizedPolicy.id}:${normalizedPolicy.code}:${normalizedPolicy.enabled}:${nowIso}`)
      .digest('hex')
      .slice(0, 10);
    const versionRecord: PolicyVersionRecord = {
      versionId: `VER-${normalizedPolicy.id}-${Date.now()}-${versionHash}`,
      policyId: normalizedPolicy.id,
      tenantId: normalizedPolicy.tenantId || 'tenant_default',
      code: normalizedPolicy.code,
      snapshot: normalizedPolicy,
      changedBy,
      timestamp: nowIso
    };

    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('policies').doc(normalizedPolicy.id).set(normalizedPolicy, { merge: true });
        await this.firestoreDb.collection('policy_versions').doc(versionRecord.versionId).create(versionRecord);
        console.log(`[StorageEngine:Firestore] Successfully saved policy: ${normalizedPolicy.id} (${normalizedPolicy.code}) and version: ${versionRecord.versionId}`);
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed saving policy ${normalizedPolicy.id}:`, err?.message || err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    const existingIndex = this.memoryStore.policies.findIndex(p => p.id === normalizedPolicy.id);
    if (existingIndex >= 0) {
      this.memoryStore.policies[existingIndex] = normalizedPolicy;
    } else {
      this.memoryStore.policies.push(normalizedPolicy);
    }
    if (!this.memoryStore.policy_versions) {
      this.memoryStore.policy_versions = [];
    }
    this.memoryStore.policy_versions.unshift(versionRecord);
    this.flushPersistentFileStore();

    return normalizedPolicy;
  }

  public async savePoliciesBatch(policies: Policy[]): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const batch = this.firestoreDb.batch();
        for (const policy of policies) {
          const docRef = this.firestoreDb.collection('policies').doc(policy.id);
          batch.set(docRef, policy, { merge: true });
        }
        await batch.commit();
        console.log(`[StorageEngine:Firestore] Successfully committed batch of ${policies.length} policies.`);
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error writing policies batch:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.policies = [...policies];
    this.flushPersistentFileStore();
  }

  public async deletePolicy(policyId: string): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('policies').doc(policyId).delete();
        console.log(`[StorageEngine:Firestore] Successfully deleted policy: ${policyId}`);
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed deleting policy ${policyId}:`, err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.policies = this.memoryStore.policies.filter(p => p.id !== policyId);
    this.flushPersistentFileStore();
  }

  public async registerApiKey(rawKey: string, tenantId: string) {
    if (!rawKey || !rawKey.trim()) return;
    const keyHash = hashTenantApiKey(rawKey.trim());
    const prefix = rawKey.trim().slice(0, 8) + '...';
    const createdAt = new Date().toISOString();

    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('tenant_api_keys').doc(keyHash).set({
          key_hash: keyHash,
          tenant_id: tenantId,
          raw_key_prefix: prefix,
          created_at: createdAt
        }, { merge: true });
        console.log(`[StorageEngine:Firestore] Successfully registered API key hash for tenant ${tenantId} (${prefix})`);
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed registering API key hash for tenant ${tenantId}:`, err?.message || err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    if (!this.memoryStore.tenant_api_keys.some(k => k.key_hash === keyHash)) {
      this.memoryStore.tenant_api_keys.push({
        key_hash: keyHash,
        tenant_id: tenantId,
        raw_key_prefix: prefix,
        created_at: createdAt
      });
      this.flushPersistentFileStore();
    }
  }

  public async getTenantApiKeys(): Promise<{ key_hash: string; tenant_id: string; raw_key_prefix: string; created_at: string }[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb.collection('tenant_api_keys').get();
        if (!snap.empty) {
          return snap.docs.map(doc => doc.data() as any);
        }
      } catch (err) {
        console.warn('[StorageEngine] Firestore getTenantApiKeys error, falling back:', err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.tenant_api_keys || [];
  }

  public async lookupTenantByApiKey(rawKey: string): Promise<string | null> {
    if (!rawKey) return null;
    const cleanKey = rawKey.trim();
    const keyHash = hashTenantApiKey(cleanKey);

    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const doc = await this.firestoreDb.collection('tenant_api_keys').doc(keyHash).get();
        if (doc.exists) {
          const data = doc.data();
          if (data?.tenant_id) return data.tenant_id;
        }
      } catch (err) {
        console.warn('[StorageEngine] Firestore lookupTenantByApiKey error, falling back:', err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    const record = this.memoryStore.tenant_api_keys.find(k => k.key_hash === keyHash);
    if (record) return record.tenant_id;

    return null;
  }

  public async saveTenant(tenant: any) {
    const rawKey = typeof tenant.apiKey === 'string' && tenant.apiKey.trim() ? tenant.apiKey.trim() : '';
    const keyHash = rawKey ? hashTenantApiKey(rawKey) : (tenant.apiKeyHash || '');

    const firestoreTenantDoc: Record<string, any> = {
      id: tenant.id,
      name: tenant.name,
      organization: tenant.organization || '',
      planTier: tenant.planTier,
      gcpMarketplaceAccountId: tenant.gcpMarketplaceAccountId || '',
      billingStatus: tenant.billingStatus,
      budgetCap: tenant.budgetCap ?? 500.0,
      currentSpend: tenant.currentSpend ?? 0.0,
      apiKeyHash: keyHash,
      createdAt: tenant.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('tenants').doc(tenant.id).set(firestoreTenantDoc, { merge: true });
        console.log(`[StorageEngine:Firestore] Successfully saved tenant: ${tenant.id} (${tenant.name})`);
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed saving tenant ${tenant.id}:`, err?.message || err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    const localTenantRecord = { ...firestoreTenantDoc, apiKey: '' };
    const existingIndex = this.memoryStore.tenants.findIndex(t => t.id === tenant.id);
    if (existingIndex >= 0) {
      this.memoryStore.tenants[existingIndex] = localTenantRecord;
    } else {
      this.memoryStore.tenants.push(localTenantRecord);
    }
    this.flushPersistentFileStore();

    if (rawKey) {
      await this.registerApiKey(rawKey, tenant.id);
    }
  }

  public async getTenants(): Promise<any[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb.collection('tenants').get();
        if (!snap.empty) {
          return snap.docs.map(d => {
            const data = d.data();
            return {
              id: data.id,
              name: data.name,
              organization: data.organization || '',
              planTier: data.planTier,
              gcpMarketplaceAccountId: data.gcpMarketplaceAccountId || '',
              billingStatus: data.billingStatus,
              budgetCap: Number(data.budgetCap ?? 500),
              currentSpend: Number(data.currentSpend ?? 0),
              apiKey: '',
              apiKeyHash: data.apiKeyHash || '',
              createdAt: data.createdAt,
              updatedAt: data.updatedAt
            };
          });
        }
      } catch (err) {
        console.warn('[StorageEngine] Firestore getTenants error, falling back:', err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.tenants;
  }

  public async appendAuditLedger(entry: AuditLedgerRow): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('audit_ledger').doc(entry.id).create({
          ...entry,
          timestamp: entry.timestamp || new Date().toISOString()
        });
        console.log(`[StorageEngine:Firestore] Successfully created immutable audit_ledger entry: ${entry.id} (${entry.event_type})`);
      } catch (err: any) {
        if (err?.code !== 6 && !String(err?.message || '').includes('ALREADY_EXISTS')) {
          console.error(`[StorageEngine:Firestore] Error writing audit_ledger entry ${entry.id}:`, err?.message || err);
        }
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    if (!this.memoryStore.audit_ledger.some(e => e.id === entry.id)) {
      this.memoryStore.audit_ledger.unshift(entry);
      this.flushPersistentFileStore();
    }
  }

  public async getAuditLedger(tenantId?: string): Promise<AuditLedgerRow[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb
          .collection('audit_ledger')
          .orderBy('timestamp', 'desc')
          .limit(200)
          .get();
        if (!snap.empty) {
          const rows = snap.docs.map(d => d.data() as AuditLedgerRow);
          if (!tenantId) return rows;
          return rows.filter(r => r.tenant_id === tenantId);
        }
      } catch (err) {
        console.warn('[StorageEngine] Firestore getAuditLedger error, falling back:', err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    if (!tenantId) return this.memoryStore.audit_ledger;
    return this.memoryStore.audit_ledger.filter(l => l.tenant_id === tenantId);
  }

  public async getGovernedAgents(tenantId?: string): Promise<GoverningAgent[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb.collection('governed_agents').get();
        const allAgents = snap.docs.map(d => d.data() as GoverningAgent);
        if (!tenantId) return allAgents;
        return allAgents.filter(a => a.tenantId === tenantId || (!a.tenantId && tenantId === 'tenant_default'));
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error reading governed_agents:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    if (!tenantId) return this.memoryStore.governed_agents;
    return this.memoryStore.governed_agents.filter(a => a.tenantId === tenantId || (!a.tenantId && tenantId === 'tenant_default'));
  }

  public async saveGovernedAgentsBatch(agents: GoverningAgent[]): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const batch = this.firestoreDb.batch();
        for (const agent of agents) {
          const docId = agent.id || `GA-${crypto.randomUUID().slice(0, 8)}`;
          const ref = this.firestoreDb.collection('governed_agents').doc(docId);
          batch.set(ref, { ...agent, id: docId }, { merge: true });
        }
        await batch.commit();
        console.log(`[StorageEngine:Firestore] Successfully wrote batch of ${agents.length} governed_agents.`);
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error writing governed_agents batch:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.governed_agents = [...agents];
    this.flushPersistentFileStore();
  }

  public async deleteGovernedAgent(agentId: string): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('governed_agents').doc(agentId).delete();
        console.log(`[StorageEngine:Firestore] Successfully deleted agent: ${agentId}`);
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Error deleting agent ${agentId}:`, err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.governed_agents = this.memoryStore.governed_agents.filter(a => a.id !== agentId);
    this.flushPersistentFileStore();
  }

  public async getKillEvents(): Promise<KillSignalEvent[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb
          .collection('kill_events')
          .orderBy('timestamp', 'desc')
          .limit(RETENTION_LIMITS.KILL_EVENTS)
          .get();
        if (!snap.empty) {
          return snap.docs.map(d => d.data() as KillSignalEvent);
        }
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error reading kill_events:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.kill_events || [];
  }

  public async createKillEvent(event: KillSignalEvent): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('kill_events').doc(event.id).set(event, { merge: true });
        console.log(`[StorageEngine:Firestore] Successfully saved kill_event: ${event.id}`);
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed saving kill_event ${event.id}:`, err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    if (!this.memoryStore.kill_events) this.memoryStore.kill_events = [];
    if (!this.memoryStore.kill_events.some(k => k.id === event.id)) {
      this.memoryStore.kill_events.unshift(event);
      this.flushPersistentFileStore();
    }
  }

  public async saveKillEventsBatch(events: KillSignalEvent[]): Promise<void> {
    const capped = events.slice(0, RETENTION_LIMITS.KILL_EVENTS);
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const batch = this.firestoreDb.batch();
        for (const ev of capped) {
          const ref = this.firestoreDb.collection('kill_events').doc(ev.id);
          batch.set(ref, ev, { merge: true });
        }
        await batch.commit();
        console.log(`[StorageEngine:Firestore] Successfully wrote batch of ${capped.length} kill_events.`);
        await this.enforceCollectionRetention('kill_events', RETENTION_LIMITS.KILL_EVENTS, 'timestamp');
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error writing kill_events batch:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.kill_events = capped;
    this.flushPersistentFileStore();
  }

  public async getDriftEvents(): Promise<DriftLogEvent[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb
          .collection('drift_events')
          .orderBy('timestamp', 'desc')
          .limit(RETENTION_LIMITS.DRIFT_EVENTS)
          .get();
        if (!snap.empty) {
          return snap.docs.map(d => d.data() as DriftLogEvent);
        }
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error reading drift_events:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.drift_events || [];
  }

  public async saveDriftEventsBatch(events: DriftLogEvent[]): Promise<void> {
    const capped = events.slice(0, RETENTION_LIMITS.DRIFT_EVENTS);
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const batch = this.firestoreDb.batch();
        for (const ev of capped) {
          const ref = this.firestoreDb.collection('drift_events').doc(ev.id);
          batch.set(ref, ev, { merge: true });
        }
        await batch.commit();
        console.log(`[StorageEngine:Firestore] Successfully wrote batch of ${capped.length} drift_events.`);
        await this.enforceCollectionRetention('drift_events', RETENTION_LIMITS.DRIFT_EVENTS, 'timestamp');
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error writing drift_events batch:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.drift_events = capped;
    this.flushPersistentFileStore();
  }

  public async createDriftEvent(event: DriftLogEvent): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('drift_events').doc(event.id).set(event, { merge: true });
        await this.enforceCollectionRetention('drift_events', RETENTION_LIMITS.DRIFT_EVENTS, 'timestamp');
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed saving drift_event ${event.id}:`, err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    if (!this.memoryStore.drift_events) this.memoryStore.drift_events = [];
    if (!this.memoryStore.drift_events.some(d => d.id === event.id)) {
      this.memoryStore.drift_events.unshift(event);
      if (this.memoryStore.drift_events.length > RETENTION_LIMITS.DRIFT_EVENTS) {
        this.memoryStore.drift_events = this.memoryStore.drift_events.slice(0, RETENTION_LIMITS.DRIFT_EVENTS);
      }
      this.flushPersistentFileStore();
    }
  }

  public async saveDriftEvent(event: DriftLogEvent): Promise<void> {
    return this.createDriftEvent(event);
  }

  public async getApiLogs(): Promise<ApiRequestLog[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb
          .collection('api_logs')
          .orderBy('timestamp', 'desc')
          .limit(RETENTION_LIMITS.API_LOGS)
          .get();
        if (!snap.empty) {
          return snap.docs.map(d => d.data() as ApiRequestLog);
        }
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error reading api_logs:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.api_logs || [];
  }

  public async createApiLog(log: ApiRequestLog): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('api_logs').doc(log.id).set(log, { merge: true });
        await this.enforceCollectionRetention('api_logs', RETENTION_LIMITS.API_LOGS, 'timestamp');
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed saving api_log ${log.id}:`, err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    if (!this.memoryStore.api_logs) this.memoryStore.api_logs = [];
    if (!this.memoryStore.api_logs.some(l => l.id === log.id)) {
      this.memoryStore.api_logs.unshift(log);
      if (this.memoryStore.api_logs.length > RETENTION_LIMITS.API_LOGS) {
        this.memoryStore.api_logs = this.memoryStore.api_logs.slice(0, RETENTION_LIMITS.API_LOGS);
      }
      this.flushPersistentFileStore();
    }
  }

  public async saveApiLog(log: ApiRequestLog): Promise<void> {
    return this.createApiLog(log);
  }

  public async saveApiLogsBatch(logs: ApiRequestLog[]): Promise<void> {
    const capped = logs.slice(0, RETENTION_LIMITS.API_LOGS);
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const batch = this.firestoreDb.batch();
        for (const log of capped.slice(0, 50)) {
          const ref = this.firestoreDb.collection('api_logs').doc(log.id);
          batch.set(ref, log, { merge: true });
        }
        await batch.commit();
        console.log(`[StorageEngine:Firestore] Successfully wrote batch of ${Math.min(capped.length, 50)} api_logs.`);
        await this.enforceCollectionRetention('api_logs', RETENTION_LIMITS.API_LOGS, 'timestamp');
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error writing api_logs batch:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.api_logs = capped;
    this.flushPersistentFileStore();
  }

  public async getNotifications(): Promise<any[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb
          .collection('notifications')
          .orderBy('timestamp', 'desc')
          .limit(RETENTION_LIMITS.NOTIFICATIONS)
          .get();
        if (!snap.empty) {
          return snap.docs.map(d => d.data());
        }
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error reading notifications:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.notifications || [];
  }

  public async createNotification(notification: any): Promise<void> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('notifications').doc(notification.id).set(notification, { merge: true });
        console.log(`[StorageEngine:Firestore] Successfully saved notification: ${notification.id}`);
      } catch (err: any) {
        console.error(`[StorageEngine:Firestore] Failed saving notification ${notification.id}:`, err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    if (!this.memoryStore.notifications) this.memoryStore.notifications = [];
    if (!this.memoryStore.notifications.some(n => n.id === notification.id)) {
      this.memoryStore.notifications.unshift(notification);
      this.flushPersistentFileStore();
    }
  }

  public async saveNotificationsBatch(notifications: any[]): Promise<void> {
    const capped = notifications.slice(0, RETENTION_LIMITS.NOTIFICATIONS);
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const batch = this.firestoreDb.batch();
        for (const notif of capped) {
          const ref = this.firestoreDb.collection('notifications').doc(notif.id);
          batch.set(ref, notif, { merge: true });
        }
        await batch.commit();
        console.log(`[StorageEngine:Firestore] Successfully wrote batch of ${capped.length} notifications.`);
        await this.enforceCollectionRetention('notifications', RETENTION_LIMITS.NOTIFICATIONS, 'timestamp');
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error writing notifications batch:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.notifications = capped;
    this.flushPersistentFileStore();
  }

  public async getValueMetrics(): Promise<ValueMeterMetric[]> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const snap = await this.firestoreDb
          .collection('value_metrics')
          .orderBy('timestamp', 'desc')
          .limit(RETENTION_LIMITS.VALUE_METRICS)
          .get();
        if (!snap.empty) {
          return snap.docs.map(d => d.data() as ValueMeterMetric);
        }
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error reading value_metrics:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.value_metrics || [];
  }

  public async saveValueMetricsBatch(metrics: ValueMeterMetric[]): Promise<void> {
    const capped = metrics.slice(0, RETENTION_LIMITS.VALUE_METRICS);
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const batch = this.firestoreDb.batch();
        for (const m of capped) {
          const ref = this.firestoreDb.collection('value_metrics').doc(m.id);
          batch.set(ref, m, { merge: true });
        }
        await batch.commit();
        console.log(`[StorageEngine:Firestore] Successfully wrote batch of ${capped.length} value_metrics.`);
        await this.enforceCollectionRetention('value_metrics', RETENTION_LIMITS.VALUE_METRICS, 'timestamp');
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error writing value_metrics batch:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.value_metrics = capped;
    this.flushPersistentFileStore();
  }

  public async getGlobalConfig(): Promise<GlobalConfigDocument | null> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const doc = await this.firestoreDb.collection('system_state').doc('global_config').get();
        if (doc.exists) {
          return doc.data() as GlobalConfigDocument;
        }
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error reading global_config:', err?.message || err);
      }
    }
    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.global_config || null;
  }

  public async saveGlobalConfig(config: GlobalConfigDocument): Promise<void> {
    const payload: GlobalConfigDocument = {
      laborConfig: config.laborConfig,
      budgetCap: config.budgetCap,
      governanceMode: config.governanceMode,
      globalSettings: config.globalSettings,
      tenantFailureConfig: config.tenantFailureConfig,
      updatedAt: new Date().toISOString()
    };

    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('system_state').doc('global_config').set(payload, { merge: true });
        console.log('[StorageEngine:Firestore] Successfully saved global_config to system_state/global_config.');
      } catch (err: any) {
        console.error('[StorageEngine:Firestore] Error writing global_config:', err?.message || err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.global_config = payload;
    this.flushPersistentFileStore();
  }

  public checkRateLimit(key: string, maxRequests: number = 120, windowMs: number = 60000): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.rateLimitStore.get(key);
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + windowMs;
      this.rateLimitStore.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: Math.max(0, maxRequests - 1), resetAt };
    }
    entry.count += 1;
    const allowed = entry.count <= maxRequests;
    return {
      allowed,
      remaining: Math.max(0, maxRequests - entry.count),
      resetAt: entry.resetAt
    };
  }

  public async incrementBudgetSpend(tenantId: string, agentId: string, amount: number): Promise<{ success: boolean; newSpend: number }> {
    const docId = `${tenantId}__${agentId}`;

    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const ref = this.firestoreDb.collection('budget_counters').doc(docId);
        await ref.set({
          tenantId,
          agentId,
          spend: FieldValue.increment(amount),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        const snap = await ref.get();
        const newSpend = Number(snap.data()?.spend ?? amount);
        return { success: true, newSpend };
      } catch (err) {
        console.warn('[StorageEngine] Firestore incrementBudgetSpend error, falling back:', err);
      }
    }

    const key = `tenant:${tenantId}:agent:${agentId}:spend`;
    const currentVal = await this.getKv(key);
    const current = parseFloat(currentVal || '0.0');
    const newSpend = current + amount;
    await this.setKv(key, newSpend.toString());

    return { success: true, newSpend };
  }

  public async getKv(key: string): Promise<string | null> {
    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const safeKey = key.replace(/\//g, '__');
        const doc = await this.firestoreDb.collection('kv_store').doc(safeKey).get();
        if (doc.exists) {
          return doc.data()?.v ?? null;
        }
      } catch (err) {
        console.warn('[StorageEngine] Firestore getKv error, falling back:', err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    return this.memoryStore.kv_store[key]?.v || null;
  }

  public async setKv(key: string, value: string): Promise<void> {
    const updatedAt = new Date().toISOString();

    if (this.isFirestoreConnected && this.firestoreDb) {
      try {
        const safeKey = key.replace(/\//g, '__');
        await this.firestoreDb.collection('kv_store').doc(safeKey).set({
          k: key,
          v: value,
          updated_at: updatedAt
        }, { merge: true });
      } catch (err) {
        console.warn('[StorageEngine] Firestore setKv error, falling back:', err);
      }
    }

    this.memoryStore = this.loadPersistentFileStore();
    this.memoryStore.kv_store[key] = { v: value, updated_at: updatedAt };
    this.flushPersistentFileStore();
  }
}

export const storageEngine = new StorageEngine();
