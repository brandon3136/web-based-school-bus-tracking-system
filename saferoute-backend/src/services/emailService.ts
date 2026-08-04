// Emails are sent via Brevo's HTTP API (not SMTP). Render's free tier blocks
// all outbound traffic on SMTP ports (25, 465, 587), so nodemailer/SMTP
// cannot work there. Brevo's API runs over regular HTTPS (port 443), which
// is not blocked.
import { randomUUID } from "crypto";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const apiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL;
const senderName = process.env.BREVO_SENDER_NAME || "SafeRoute School Bus Tracker";
const frontendUrl = process.env.FRONTEND_URL || "https://web-based-school-bus-tracking-syste.vercel.app";

interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
  headers?: Record<string, string>;
}

async function sendViaBrevo(payload: BrevoEmailPayload): Promise<void> {
  if (!apiKey || !senderEmail) {
    throw new Error("Brevo configuration is missing. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.");
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
  }
}

export async function sendParentCredentialsEmail(parentName: string, parentEmail: string, password: string): Promise<void> {
  const schoolName = "SafeRoute School Bus Tracker";
  const loginUrl = `${frontendUrl}/login?role=parent`;

  const textContent = `Hello ${parentName},

Welcome to the ${schoolName}. A parent account has been created for you so you can track your child's school bus in real time.

Your login credentials:
  Username: ${parentEmail}
  Temporary password: ${password}

Sign in here: ${loginUrl}

You will be asked to set a new password on your first login.

If you did not expect this email, please contact your school administrator.

Best regards,
The ${schoolName} team`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; background-color:#f4f4f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:30px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background-color:#0F2B5B; padding:24px 32px; text-align:center;">
            <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:600;">${schoolName}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px; font-size:15px; color:#333333;">Hello <strong>${parentName}</strong>,</p>
            <p style="margin:0 0 24px; font-size:15px; color:#333333; line-height:1.6;">
              Welcome to the ${schoolName}. A parent account has been created for you so you can track your child's school bus in real time.
            </p>

            <!-- Credentials box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px; font-size:13px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Your Login Credentials</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:6px 0; font-size:14px; color:#64748b; width:140px;">Username</td>
                      <td style="padding:6px 0; font-size:14px; color:#1e293b; font-weight:600;">${parentEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:14px; color:#64748b;">Temporary password</td>
                      <td style="padding:6px 0; font-size:14px; color:#1e293b; font-weight:600; font-family:monospace; letter-spacing:1px;">${password}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 12px; font-size:14px; color:#333333; line-height:1.6;">
              Click the button below to sign in with the credentials above. You will be asked to set a new password on your first login.
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="border-radius:8px; background-color:#0D9488;">
                  <a href="${loginUrl}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">
                    Sign in to SafeRoute
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px; font-size:13px; color:#94a3b8;">
              If you did not expect this email, please contact your school administrator.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f8fafc; padding:16px 32px; border-top:1px solid #e2e8f0; text-align:center;">
            <p style="margin:0; font-size:12px; color:#94a3b8;">
              &copy; ${new Date().getFullYear()} ${schoolName}. This is an automated message.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  await sendViaBrevo({
    sender: { name: senderName, email: senderEmail! },
    to: [{ email: parentEmail, name: parentName }],
    subject: `Your ${schoolName} account is ready`,
    htmlContent,
    textContent,
    headers: {
      "X-Mailer": schoolName,
      "Message-ID": `<${randomUUID()}@saferoute.school>`,
    },
  });
}

export async function sendDriverCredentialsEmail(driverName: string, driverEmail: string, password: string): Promise<void> {
  const schoolName = "SafeRoute School Bus Tracker";
  const loginUrl = `${frontendUrl}/login?role=driver`;

  const textContent = `Hello ${driverName},

Welcome to the ${schoolName}. A driver account has been created for you so you can manage trips, log GPS positions, and mark student boarding.

Your login credentials:
  Username: ${driverEmail}
  Temporary password: ${password}

Sign in here: ${loginUrl}

You will be asked to set a new password on your first login.

If you did not expect this email, please contact your school administrator.

Best regards,
The ${schoolName} team`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; background-color:#f4f4f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:30px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#0F2B5B; padding:24px 32px; text-align:center;">
            <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:600;">${schoolName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px; font-size:15px; color:#333333;">Hello <strong>${driverName}</strong>,</p>
            <p style="margin:0 0 24px; font-size:15px; color:#333333; line-height:1.6;">
              Welcome to the ${schoolName}. A driver account has been created for you so you can manage trips, log GPS positions, and mark student boarding.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px; font-size:13px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Your Login Credentials</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:6px 0; font-size:14px; color:#64748b; width:140px;">Username</td>
                      <td style="padding:6px 0; font-size:14px; color:#1e293b; font-weight:600;">${driverEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:14px; color:#64748b;">Temporary password</td>
                      <td style="padding:6px 0; font-size:14px; color:#1e293b; font-weight:600; font-family:monospace; letter-spacing:1px;">${password}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 12px; font-size:14px; color:#333333; line-height:1.6;">
              Click the button below and select the <strong>Driver</strong> tab to sign in with the credentials above. You will be asked to set a new password on your first login.
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="border-radius:8px; background-color:#F5A623;">
                  <a href="${loginUrl}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:600; color:#0F2B5B; text-decoration:none;">
                    Sign in to SafeRoute
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px; font-size:13px; color:#94a3b8;">
              If you did not expect this email, please contact your school administrator.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc; padding:16px 32px; border-top:1px solid #e2e8f0; text-align:center;">
            <p style="margin:0; font-size:12px; color:#94a3b8;">
              &copy; ${new Date().getFullYear()} ${schoolName}. This is an automated message.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  await sendViaBrevo({
    sender: { name: senderName, email: senderEmail! },
    to: [{ email: driverEmail, name: driverName }],
    subject: `Your ${schoolName} driver account is ready`,
    htmlContent,
    textContent,
    headers: {
      "X-Mailer": schoolName,
      "Message-ID": `<${randomUUID()}@saferoute.school>`,
    },
  });
}