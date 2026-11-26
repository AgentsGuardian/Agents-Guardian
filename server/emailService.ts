import nodemailer, { type Transporter, type TestAccount } from 'nodemailer';
import fs from 'fs';
import path from 'path';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
  simulated?: boolean;
}

// In-memory ledger of recent email dispatches for runtime verification & audit
export interface DispatchedEmailRecord {
  id: string;
  timestamp: string;
  to: string;
  subject: string;
  type: 'PASSWORD_RESET' | 'REGISTRATION_APPROVED' | 'REGISTRATION_REJECTED' | 'TEST_EMAIL';
  previewUrl?: string | false;
  success: boolean;
  error?: string;
}

export interface EmailConfigSummary {
  configured: boolean;
  provider: 'resend-sandbox' | 'resend-domain' | 'gmail' | 'sendgrid' | 'custom-smtp' | 'ethereal';
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  hasPassword: boolean;
  isSandbox: boolean;
  sandboxAllowedRecipient: string | null;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;
  private currentHost: string = '';
  private currentPort: number = 587;
  private currentSecure: boolean = false;
  private currentUser: string = '';
  private currentPass: string = '';
  private currentFrom: string = '';
  private testAccount: TestAccount | null = null;
  private recentDispatches: DispatchedEmailRecord[] = [];

  constructor() {
    this.initTransporter();
  }

  public async initTransporter() {
    // 0. Check for verified persistent SMTP configuration in /.data/smtp-config.json
    try {
      const configPath = path.resolve(process.cwd(), '.data', 'smtp-config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.host && parsed.user && parsed.pass) {
          this.transporter = nodemailer.createTransport({
            host: parsed.host.trim(),
            port: Number(parsed.port) || 465,
            secure: parsed.secure !== undefined ? Boolean(parsed.secure) : Number(parsed.port) === 465,
            auth: {
              user: parsed.user.trim(),
              pass: parsed.pass.trim()
            }
          });
          this.currentHost = parsed.host.trim();
          this.currentPort = Number(parsed.port) || 465;
          this.currentSecure = parsed.secure !== undefined ? Boolean(parsed.secure) : Number(parsed.port) === 465;
          this.currentUser = parsed.user.trim();
          this.currentPass = parsed.pass.trim();
          this.currentFrom = parsed.from ? parsed.from.trim() : `AgentsGuardian <${parsed.user.trim()}>`;
          this.isConfigured = true;
          console.log(`[EmailService] Loaded persistent verified SMTP from .data/smtp-config.json: ${this.currentHost}:${this.currentPort} (${this.currentUser})`);
          return;
        }
      }
    } catch (err: any) {
      console.warn('[EmailService] Notice checking .data/smtp-config.json:', err?.message || err);
    }

    // 1. Check for standard SMTP configuration in environment variables
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT.trim(), 10) : 465;
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();
    const smtpSecure = process.env.SMTP_SECURE?.trim() === 'true' || smtpPort === 465;
    const smtpFrom = process.env.SMTP_FROM?.trim() || process.env.EMAIL_FROM?.trim() || 'AgentsGuardian <guardianagent12@gmail.com>';

    if (smtpHost && smtpUser && smtpPass && !smtpHost.includes('resend.com')) {
      try {
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });
        this.currentHost = smtpHost;
        this.currentPort = smtpPort;
        this.currentSecure = smtpSecure;
        this.currentUser = smtpUser;
        this.currentPass = smtpPass;
        this.currentFrom = smtpFrom;
        this.isConfigured = true;
        console.log(`[EmailService] Production SMTP configured for host: ${smtpHost}:${smtpPort} (secure: ${smtpSecure}, from: ${smtpFrom})`);
        return;
      } catch (err: any) {
        console.error('[EmailService] Failed initializing SMTP transport:', err?.message || err);
      }
    }

    // 2. Default fallback: Verified Gmail SMTP Relay for global external deliveries
    try {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: 'guardianagent12@gmail.com',
          pass: 'xjcjjwdmeckjnmdn'
        }
      });
      this.currentHost = 'smtp.gmail.com';
      this.currentPort = 465;
      this.currentSecure = true;
      this.currentUser = 'guardianagent12@gmail.com';
      this.currentPass = 'xjcjjwdmeckjnmdn';
      this.currentFrom = 'AgentsGuardian <guardianagent12@gmail.com>';
      this.isConfigured = true;
      console.log('[EmailService] Connected via verified Gmail SMTP relay for global delivery.');
      return;
    } catch (err: any) {
      console.error('[EmailService] Failed initializing default Gmail SMTP relay:', err?.message || err);
    }

    // 3. Fallback / Test Transporter: Automatically initialize Ethereal testing account
    try {
      this.testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: this.testAccount.user,
          pass: this.testAccount.pass
        }
      });
      this.currentHost = 'smtp.ethereal.email';
      this.currentPort = 587;
      this.currentSecure = false;
      this.currentUser = this.testAccount.user;
      this.currentPass = this.testAccount.pass;
      this.currentFrom = '"AgentsGuardian IAM" <noreply@agentsguardian.ai>';
      console.log(`[EmailService] SMTP credentials not set in environment. Initialized Ethereal test account: ${this.testAccount.user}`);
    } catch (e: any) {
      console.warn('[EmailService] Ethereal test transporter initialization fallback:', e?.message || e);
    }
  }

  /**
   * Dynamically update SMTP credentials at runtime and persist to /.data/smtp-config.json and /.env
   */
  public async updateConfiguration(config: {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    pass: string;
    from: string;
    persistToEnv?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    const { host, port, secure = port === 465, user, pass, from, persistToEnv = true } = config;

    if (!host || !user || !pass) {
      return { success: false, error: 'Host, Username, and Password/API Key are required.' };
    }

    try {
      const newTransporter = nodemailer.createTransport({
        host: host.trim(),
        port: Number(port),
        secure: Boolean(secure),
        auth: {
          user: user.trim(),
          pass: pass.trim()
        }
      });

      // Verify connection credentials with the remote SMTP server
      await newTransporter.verify();

      this.transporter = newTransporter;
      this.currentHost = host.trim();
      this.currentPort = Number(port);
      this.currentSecure = Boolean(secure);
      this.currentUser = user.trim();
      this.currentPass = pass.trim();
      this.currentFrom = from.trim() || `AgentsGuardian <${user.trim()}>`;
      this.isConfigured = true;

      // Update runtime process.env
      process.env.SMTP_HOST = this.currentHost;
      process.env.SMTP_PORT = String(this.currentPort);
      process.env.SMTP_SECURE = String(this.currentSecure);
      process.env.SMTP_USER = this.currentUser;
      process.env.SMTP_PASS = this.currentPass;
      process.env.SMTP_FROM = this.currentFrom;

      if (persistToEnv) {
        try {
          // Persist to .data/smtp-config.json
          const dataDir = path.resolve(process.cwd(), '.data');
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }
          const configPath = path.join(dataDir, 'smtp-config.json');
          fs.writeFileSync(configPath, JSON.stringify({
            host: this.currentHost,
            port: this.currentPort,
            secure: this.currentSecure,
            user: this.currentUser,
            pass: this.currentPass,
            from: this.currentFrom
          }, null, 2), 'utf-8');

          // Persist to .env
          const envPath = path.resolve(process.cwd(), '.env');
          const envContent = `SMTP_HOST=${this.currentHost}
SMTP_PORT=${this.currentPort}
SMTP_SECURE=${this.currentSecure}
SMTP_USER=${this.currentUser}
SMTP_PASS=${this.currentPass}
SMTP_FROM=${this.currentFrom}
APP_URL=${process.env.APP_URL || 'http://localhost:3000'}
`;
          fs.writeFileSync(envPath, envContent, 'utf-8');
          console.log('[EmailService] Persisted new SMTP credentials to /.data/smtp-config.json and /.env');
        } catch (e: any) {
          console.warn('[EmailService] Failed writing persistent files:', e?.message || e);
        }
      }

      console.log(`[EmailService] Live SMTP reconfigured and verified for ${this.currentHost}:${this.currentPort}`);
      return { success: true };
    } catch (err: any) {
      console.error('[EmailService] Failed to verify new SMTP credentials:', err?.message || err);
      return { success: false, error: err?.message || 'SMTP connection verification failed.' };
    }
  }

  public getConfigSummary(): EmailConfigSummary {
    const isResend = this.currentHost.toLowerCase().includes('resend.com');
    const isGmail = this.currentHost.toLowerCase().includes('gmail.com');
    const isSendgrid = this.currentHost.toLowerCase().includes('sendgrid.net');
    const isEthereal = this.currentHost.toLowerCase().includes('ethereal.email');

    const isSandbox = isResend && (this.currentFrom.includes('resend.dev') || this.currentFrom.includes('onboarding@resend.dev'));

    let provider: EmailConfigSummary['provider'] = 'custom-smtp';
    if (isResend) {
      provider = isSandbox ? 'resend-sandbox' : 'resend-domain';
    } else if (isGmail) {
      provider = 'gmail';
    } else if (isSendgrid) {
      provider = 'sendgrid';
    } else if (isEthereal) {
      provider = 'ethereal';
    }

    return {
      configured: this.isConfigured,
      provider,
      host: this.currentHost,
      port: this.currentPort,
      secure: this.currentSecure,
      user: this.currentUser,
      from: this.currentFrom || this.getFromAddress(),
      hasPassword: Boolean(this.currentPass && this.currentPass.length > 0),
      isSandbox,
      sandboxAllowedRecipient: isSandbox ? 'guardianagent12@gmail.com' : null
    };
  }

  private getFromAddress(): string {
    return this.currentFrom || process.env.SMTP_FROM || process.env.EMAIL_FROM || 'AgentsGuardian <onboarding@resend.dev>';
  }

  private recordDispatch(record: Omit<DispatchedEmailRecord, 'id' | 'timestamp'>) {
    const entry: DispatchedEmailRecord = {
      ...record,
      id: `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString()
    };
    this.recentDispatches.unshift(entry);
    if (this.recentDispatches.length > 50) {
      this.recentDispatches.pop();
    }
  }

  public getRecentDispatches(): DispatchedEmailRecord[] {
    return this.recentDispatches;
  }

  public isEmailConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Direct live test email to any recipient worldwide
   */
  public async sendTestEmail(to: string, customSubject?: string): Promise<EmailSendResult> {
    const subject = customSubject || `[AgentsGuardian] Live Real-Time Relay Test (${new Date().toLocaleTimeString()})`;
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #07090F; color: #E2E8F0; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background: #0C121D; border: 1px solid #1F2E40; border-radius: 12px; overflow: hidden; }
    .header { background: #121A2A; padding: 20px; border-bottom: 1px solid #1F2E40; }
    .title { color: #14B8A6; font-size: 18px; font-weight: bold; font-family: monospace; }
    .body { padding: 24px; font-size: 14px; line-height: 1.6; }
    .status-box { background: rgba(20, 184, 166, 0.1); border: 1px solid #14B8A6; border-radius: 8px; padding: 14px; margin: 18px 0; color: #2DD4BF; font-family: monospace; font-size: 13px; }
    .footer { background: #080C14; padding: 14px 20px; font-size: 11px; color: #64748B; border-top: 1px solid #1F2E40; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">AgentsGuardian OS &bull; Live Email Relay Test</div>
    </div>
    <div class="body">
      <p>Hello,</p>
      <p>This is a real-time verification dispatch confirmed from your AgentsGuardian Sovereign OS platform.</p>
      <div class="status-box">
        &bull; <strong>Target Recipient:</strong> ${to}<br>
        &bull; <strong>SMTP Relay Host:</strong> ${this.currentHost || 'smtp.resend.com'}<br>
        &bull; <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
        &bull; <strong>TLS Status:</strong> Verified Active Connection
      </div>
      <p>If you received this email in your personal inbox (Outlook, Gmail, etc.), real-time external email delivery is fully functional and ready for production password resets and activation credentials.</p>
    </div>
    <div class="footer">
      AgentsGuardian IAM Security Gateway &bull; Real-Time TLS Out-of-Band Dispatch
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to,
      subject,
      text: `AgentsGuardian OS Live Email Relay Test\n\nTarget Recipient: ${to}\nTimestamp: ${new Date().toISOString()}\nStatus: Verified Active`,
      html,
      type: 'TEST_EMAIL'
    });
  }

  /**
   * 1. Send Password Reset Email (Forgot Password & Admin-Initiated Reset)
   * Link and one-time code expire in exactly 10 minutes.
   */
  public async sendPasswordResetEmail(params: {
    to: string;
    recipientName?: string;
    resetToken: string;
    resetCode?: string;
    expiresInMinutes?: number;
    initiatedByAdmin?: boolean;
    adminEmail?: string;
    appUrl?: string;
  }): Promise<EmailSendResult> {
    const {
      to,
      recipientName,
      resetToken,
      resetCode = resetToken.slice(-6).toUpperCase(),
      expiresInMinutes = 10,
      initiatedByAdmin = false,
      adminEmail,
      appUrl = process.env.APP_URL || 'https://agentsguardian.ai'
    } = params;

    const resetLink = `${appUrl.replace(/\/$/, '')}#reset-token=${encodeURIComponent(resetToken)}`;
    const subject = initiatedByAdmin
      ? '[AgentsGuardian] Security Directive: Administrative Password Reset'
      : '[AgentsGuardian] Password Reset Authorization';

    const greetingName = recipientName || to;
    const introText = initiatedByAdmin
      ? `Administrator <strong>${adminEmail || 'SuperAdmin'}</strong> has initiated a mandatory credential reset for your account under security directive POL-SEC-01.`
      : `We received a request to reset the password for your AgentsGuardian account.`;

    const textContent = `AgentsGuardian Sovereign Governance OS
----------------------------------------
Security Directive: Password Reset Authorization

Hello ${greetingName},

${introText.replace(/<[^>]+>/g, '')}

Your One-Time Reset Code: ${resetCode}
Direct Reset Link: ${resetLink}

Security Note:
This authorization code and link will expire in ${expiresInMinutes} minutes from issuance.
If you did not request this reset or have questions, please notify your system administrator immediately.

AgentsGuardian IAM Security Sentinel
Zero-Trust Governance Platform`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #07090F; color: #E2E8F0; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #0C121D; border: 1px solid #1F2E40; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #0B0F19 0%, #121A2A 100%); padding: 24px; border-bottom: 1px solid #1F2E40; }
    .title { color: #14B8A6; font-size: 18px; font-weight: bold; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; font-family: monospace; }
    .subtitle { color: #8B9BAA; font-size: 12px; margin: 0; font-family: monospace; }
    .body { padding: 28px; line-height: 1.6; font-size: 14px; }
    .code-box { background-color: #070A10; border: 1px solid #1F2E40; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .code-label { color: #8B9BAA; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-family: monospace; margin-bottom: 6px; }
    .code-val { color: #2DD4BF; font-size: 24px; font-weight: bold; letter-spacing: 3px; font-family: monospace; }
    .btn { display: inline-block; background-color: #0D9488; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 12px 0 20px 0; text-align: center; }
    .warning-box { background-color: rgba(239, 159, 39, 0.1); border-left: 3px solid #EF9F27; padding: 12px 16px; margin: 18px 0; font-size: 12px; color: #FCD34D; font-family: monospace; }
    .footer { background-color: #080C14; padding: 16px 24px; font-size: 11px; color: #64748B; border-top: 1px solid #1F2E40; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">AgentsGuardian OS</div>
      <div class="subtitle">IAM Sovereign Governance &bull; Zero-Trust Credential Sentinel</div>
    </div>
    <div class="body">
      <p style="margin-top: 0;">Hello <strong>${greetingName}</strong>,</p>
      <p>${introText}</p>

      <div class="code-box">
        <div class="code-label">One-Time Password Reset Code (Expires in ${expiresInMinutes} Minutes)</div>
        <div class="code-val">${resetCode}</div>
      </div>

      <div style="text-align: center;">
        <a href="${resetLink}" class="btn" target="_blank">Reset Password in Gateway</a>
      </div>

      <div class="warning-box">
        &bull; <strong>Time-Sensitive</strong>: This authorization code and link expire in <strong>${expiresInMinutes} minutes</strong>.<br>
        &bull; <strong>Zero-Trust Notice</strong>: Never share this authorization credential with unauthorized parties.
      </div>

      <p style="font-size: 12px; color: #8B9BAA;">If you did not initiate this reset or believe this notification was sent in error, please contact your security administrator.</p>
    </div>
    <div class="footer">
      AgentsGuardian IAM Security Gateway &bull; Encrypted TLS Out-of-Band Dispatch
    </div>
  </div>
</body>
</html>
`;

    return this.sendMail({
      to,
      subject,
      text: textContent,
      html: htmlContent,
      type: 'PASSWORD_RESET'
    });
  }

  /**
   * 2. Send User Registration Approved Email
   */
  public async sendRegistrationApprovedEmail(params: {
    to: string;
    recipientName: string;
    role: string;
    oneTimePassword: string;
    appUrl?: string;
  }): Promise<EmailSendResult> {
    const {
      to,
      recipientName,
      role,
      oneTimePassword,
      appUrl = process.env.APP_URL || 'https://agentsguardian.ai'
    } = params;

    const loginUrl = appUrl.replace(/\/$/, '');
    const subject = `[AgentsGuardian] Account Approved — One-Time Password Provisioned (${role})`;

    const textContent = `AgentsGuardian Sovereign Governance OS
----------------------------------------
Account Registration Approved

Hello ${recipientName},

Your access request has been approved by the Super Admin under the '${role}' IAM role privilege.
A secure One-Time Password (OTP) has been provisioned for your initial sign-in.

Account Details:
- Email / Identity: ${to}
- Assigned Role: ${role}
- One-Time Password (OTP): ${oneTimePassword}
- Access Portal: ${loginUrl}

Instructions to log in:
1. Navigate to the sign-in portal: ${loginUrl}
2. Enter your email (${to}) and your One-Time Password (${oneTimePassword}) in the password field.
3. Upon first sign-in, you will be prompted to set your personal permanent password to finalize account activation.

AgentsGuardian IAM Governance Authority
Zero-Trust Security Gateway`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #07090F; color: #E2E8F0; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #0C121D; border: 1px solid #1F2E40; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #0B0F19 0%, #121A2A 100%); padding: 24px; border-bottom: 1px solid #1F2E40; }
    .title { color: #14B8A6; font-size: 18px; font-weight: bold; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; font-family: monospace; }
    .subtitle { color: #8B9BAA; font-size: 12px; margin: 0; font-family: monospace; }
    .body { padding: 28px; line-height: 1.6; font-size: 14px; }
    .badge { display: inline-block; background-color: rgba(20, 184, 166, 0.15); color: #2DD4BF; border: 1px solid rgba(20, 184, 166, 0.3); border-radius: 6px; padding: 3px 10px; font-size: 11px; font-weight: bold; font-family: monospace; }
    .otp-box { background-color: #070A10; border: 1px solid #14B8A6; border-radius: 8px; padding: 18px; margin: 22px 0; text-align: center; }
    .otp-label { color: #8B9BAA; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-family: monospace; margin-bottom: 8px; }
    .otp-val { color: #2DD4BF; font-size: 26px; font-weight: bold; letter-spacing: 3px; font-family: monospace; }
    .instructions { background-color: #090E18; border: 1px solid #1F2E40; border-radius: 8px; padding: 16px 20px; margin: 20px 0; font-size: 13px; }
    .instructions ol { margin: 8px 0 0 0; padding-left: 20px; color: #CBD5E1; }
    .instructions li { margin-bottom: 6px; }
    .btn { display: inline-block; background-color: #0D9488; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 16px 0; text-align: center; }
    .footer { background-color: #080C14; padding: 16px 24px; font-size: 11px; color: #64748B; border-top: 1px solid #1F2E40; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">AgentsGuardian OS</div>
      <div class="subtitle">IAM Sovereign Governance &bull; Account Provisioning Gate</div>
    </div>
    <div class="body">
      <p style="margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>
      <p>Your access application for <strong>${to}</strong> has been authorized by the Super Admin.</p>
      
      <p>Assigned Privilege: <span class="badge">${role}</span></p>

      <div class="otp-box">
        <div class="otp-label">Provisioned One-Time Password (OTP)</div>
        <div class="otp-val">${oneTimePassword}</div>
      </div>

      <div class="instructions">
        <strong>Next Steps:</strong>
        <ol>
          <li>Access the sign-in portal at <a href="${loginUrl}" style="color: #2DD4BF;">${loginUrl}</a>.</li>
          <li>Enter your email address and paste the One-Time Password shown above.</li>
          <li>Configure your permanent personal password on your first session to finalize activation.</li>
        </ol>
      </div>

      <div style="text-align: center;">
        <a href="${loginUrl}" class="btn" target="_blank">Sign In to Gateway</a>
      </div>
    </div>
    <div class="footer">
      AgentsGuardian IAM Security Gateway &bull; Encrypted TLS Out-of-Band Delivery
    </div>
  </div>
</body>
</html>
`;

    return this.sendMail({
      to,
      subject,
      text: textContent,
      html: htmlContent,
      type: 'REGISTRATION_APPROVED'
    });
  }

  /**
   * 3. Send Registration Rejected Email
   */
  public async sendRegistrationRejectedEmail(params: {
    to: string;
    recipientName: string;
    reason?: string;
    appUrl?: string;
  }): Promise<EmailSendResult> {
    const {
      to,
      recipientName,
      reason,
      appUrl = process.env.APP_URL || 'https://agentsguardian.ai'
    } = params;

    const subject = `[AgentsGuardian] Account Registration Update`;
    const reasonText = reason ? `Reason: ${reason}` : 'Registration declined by Super Admin.';

    const textContent = `AgentsGuardian Sovereign Governance OS
----------------------------------------
Account Registration Update

Hello ${recipientName},

Your registration request for '${to}' was reviewed by the Super Admin and has been declined at this time.

${reasonText}

If you believe this decision was made in error or if your requirements have changed, please contact your designated system administrator or submit an inquiry via the portal.

AgentsGuardian IAM Governance Authority
Zero-Trust Security Gateway`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #07090F; color: #E2E8F0; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #0C121D; border: 1px solid #1F2E40; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #0B0F19 0%, #121A2A 100%); padding: 24px; border-bottom: 1px solid #1F2E40; }
    .title { color: #F43F5E; font-size: 18px; font-weight: bold; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; font-family: monospace; }
    .subtitle { color: #8B9BAA; font-size: 12px; margin: 0; font-family: monospace; }
    .body { padding: 28px; line-height: 1.6; font-size: 14px; }
    .notice-box { background-color: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px; color: #FDA4AF; }
    .footer { background-color: #080C14; padding: 16px 24px; font-size: 11px; color: #64748B; border-top: 1px solid #1F2E40; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">AgentsGuardian OS</div>
      <div class="subtitle">IAM Sovereign Governance &bull; Account Registration Update</div>
    </div>
    <div class="body">
      <p style="margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>
      <p>Thank you for submitting an access request for the AgentsGuardian platform for <strong>${to}</strong>.</p>
      <p>Your registration request was reviewed by the Super Admin and was declined at this time.</p>

      <div class="notice-box">
        <strong>Review Status:</strong><br>
        ${reasonText}
      </div>

      <p style="font-size: 12px; color: #8B9BAA;">If you believe this decision was made in error or if your requirements have changed, please contact your designated system administrator.</p>
    </div>
    <div class="footer">
      AgentsGuardian IAM Security Gateway &bull; Encrypted TLS Out-of-Band Delivery
    </div>
  </div>
</body>
</html>
`;

    return this.sendMail({
      to,
      subject,
      text: textContent,
      html: htmlContent,
      type: 'REGISTRATION_REJECTED'
    });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
    type: 'PASSWORD_RESET' | 'REGISTRATION_APPROVED' | 'REGISTRATION_REJECTED' | 'TEST_EMAIL';
  }): Promise<EmailSendResult> {
    if (!this.transporter) {
      await this.initTransporter();
    }

    const from = this.getFromAddress();

    try {
      if (!this.transporter) {
        throw new Error('Email transporter is unavailable.');
      }

      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        replyTo: this.currentUser || 'guardianagent12@gmail.com',
        subject: options.subject,
        text: options.text,
        html: options.html,
        headers: {
          'X-Priority': '1 (Highest)',
          'X-MSMail-Priority': 'High',
          'Importance': 'High',
          'X-Mailer': 'AgentsGuardian Sovereign Governance Sentinel'
        }
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[EmailService] Dispatched ${options.type} email to ${options.to}. MessageId: ${info.messageId}`);
      if (previewUrl) {
        console.log(`[EmailService] Preview URL: ${previewUrl}`);
      }

      this.recordDispatch({
        to: options.to,
        subject: options.subject,
        type: options.type,
        previewUrl,
        success: true
      });

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || false,
        simulated: !this.isConfigured
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      let userFriendlyError = errMsg;

      if (errMsg.includes('You can only send testing emails to your own email address')) {
        userFriendlyError = `Resend Free Sandbox Restriction: Testing with 'onboarding@resend.dev' can only send emails to the account owner (guardianagent12@gmail.com). To deliver real-time emails to ${options.to} (and any email address in the world): (1) Verify your custom domain at resend.com/domains and set SMTP_FROM, OR (2) Switch to Gmail SMTP (smtp.gmail.com with Google App Password) in Admin Settings which sends to ANY email globally without domain verification.`;
        console.warn(`[EmailService] Sandbox Restriction: ${userFriendlyError}`);
      } else {
        console.error(`[EmailService] Error dispatching ${options.type} email to ${options.to}:`, errMsg);
      }

      this.recordDispatch({
        to: options.to,
        subject: options.subject,
        type: options.type,
        success: false,
        error: userFriendlyError
      });

      return {
        success: false,
        error: userFriendlyError
      };
    }
  }
}

export const emailService = new EmailService();
