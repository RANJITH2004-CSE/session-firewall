const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Creates and configures the email transporter
 */
function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user,
        pass
      }
    });
  }

  // Fallback transporter when credentials are not yet configured in .env
  return nodemailer.createTransport({
    jsonTransport: true
  });
}

/**
 * Masks an email for secure UI/log display (e.g. j***n@g***l.com)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***@***.***';
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***.***';
  
  const [name, domain] = parts;
  const maskedName = name.length <= 2 
    ? `${name[0]}***` 
    : `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}`;
    
  const domainParts = domain.split('.');
  const domainName = domainParts[0] || '';
  const domainExt = domainParts.slice(1).join('.');
  const maskedDomain = domainName.length <= 2
    ? `${domainName[0]}***`
    : `${domainName[0]}${'*'.repeat(Math.min(domainName.length - 2, 3))}${domainName[domainName.length - 1]}`;

  return `${maskedName}@${maskedDomain}.${domainExt}`;
}

/**
 * Generates a cryptographically strong 6-digit numeric OTP
 */
function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Dispatches a real OTP verification email.
 * SECURITY: Plaintext OTP is NEVER printed to the terminal console!
 */
async function sendOtpEmail(toEmail, otpCode, metadata = {}) {
  const transporter = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || '"Session Firewall Security" <security@sessionfirewall.local>';
  const masked = maskEmail(toEmail);

  const deviceStr = metadata.device || 'Unrecognized Web Browser';
  const locationStr = metadata.location || 'Unknown Location';
  const ipStr = metadata.ipAddress || '127.0.0.1';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; }
        .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; }
        .logo { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
        .badge { background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; }
        .code-box { background: #0f172a; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #38bdf8; }
        .expiry-warning { color: #dc2626; font-size: 12px; font-weight: 600; text-align: center; margin-top: 8px; }
        .details-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; font-size: 12px; color: #475569; margin-top: 20px; }
        .details-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">🛡️ SESSION FIREWALL</div>
          <span class="badge">Two-Factor Authentication</span>
        </div>
        <p style="font-size: 14px; color: #334155; margin: 0 0 12px;">Hello,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.5; margin: 0;">
          A login attempt with <strong>Medium Risk</strong> telemetry was detected on your account. Please use the one-time passcode below to authorize your session:
        </p>

        <div class="code-box">
          <div class="code">${otpCode}</div>
          <div class="expiry-warning">⏱️ This code expires strictly in 2 minutes. (Max 3 attempts)</div>
        </div>

        <div class="details-box">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px;">Triggering Session Telemetry:</div>
          <div class="details-row"><span>Device:</span> <strong>${deviceStr}</strong></div>
          <div class="details-row"><span>Location:</span> <strong>${locationStr}</strong></div>
          <div class="details-row"><span>IP Address:</span> <strong>${ipStr}</strong></div>
        </div>

        <p class="footer">
          If you did not initiate this request, someone may be attempting to access your account. Reject the prompt or change your credentials immediately.<br>
          Secure Automated Firewall Delivery
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Your Session Firewall Verification Passcode is: ${otpCode}

This code expires in 2 minutes (maximum 3 attempts).

Session Details:
- Device: ${deviceStr}
- Location: ${locationStr}
- IP Address: ${ipStr}

If you did not attempt this login, please secure your account immediately.
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `[Session Firewall] Verification Passcode: ${otpCode.slice(0, 3)}...`,
      text: textContent,
      html: htmlContent
    });

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      console.log(`[EMAIL] Real OTP email dispatched via Gmail to ${masked}. MessageId: ${info.messageId}`);
    } else {
      console.log(`[EMAIL] OTP email dispatched to ${masked} (Gmail SMTP not configured in .env; set EMAIL_USER & EMAIL_PASS to send live emails).`);
    }

    return {
      success: true,
      maskedEmail: masked,
      expiresInSeconds: 120
    };
  } catch (err) {
    console.error(`[EMAIL] Failed to send email to ${masked}:`, err.message);
    // Even if external SMTP fails, do not throw fatal error; return status
    return {
      success: false,
      maskedEmail: masked,
      error: err.message
    };
  }
}

module.exports = {
  sendOtpEmail,
  maskEmail,
  generateOtpCode
};
