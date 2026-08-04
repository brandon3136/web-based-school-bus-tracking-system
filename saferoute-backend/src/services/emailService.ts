import nodemailer from "nodemailer";
import { randomUUID } from "crypto";

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || "587", 10);
const secure = (process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASSWORD;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

function getTransporter() {
  if (!host || !user || !pass) {
    throw new Error("SMTP configuration is missing. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED?.toLowerCase() !== "false",
    },
  });
}

export async function sendParentCredentialsEmail(parentName: string, parentEmail: string, password: string): Promise<void> {
  const transporter = getTransporter();

  // Gmail SMTP requires From to match the authenticated user exactly
  const fromAddress = user!;
  const schoolName = "SafeRoute School Bus Tracker";

  // Mask password: show first 2 and last 2 characters, hide the rest
  const masked = password.length > 4
    ? password.slice(0, 2) + "*".repeat(password.length - 4) + password.slice(-2)
    : "****";

  const message = {
    from: `${schoolName} <${fromAddress}>`,
    to: parentEmail,
    subject: `Your ${schoolName} account is ready`,
    headers: {
      "X-Mailer": schoolName,
      "Message-ID": `<${randomUUID()}@saferoute.school>`,
      "List-Unsubscribe": `<mailto:${fromAddress}?subject=unsubscribe>`,
    },
    text: `Hello ${parentName},

Welcome to the ${schoolName}. A parent account has been created for you so you can track your child's school bus in real time.

Your login credentials:
  Username: ${parentEmail}
  Temporary password: ${password}

To get started, visit your school's login page and sign in with the credentials above. You will be asked to set a new password on your first login.

If you did not expect this email, please contact your school administrator.

Best regards,
The ${schoolName} team`,
    html: `
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
              To get started, visit your school's login page and sign in with the credentials above. You will be asked to set a new password on your first login.
            </p>

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
</html>`,
  };

  await transporter.sendMail(message);
}

export async function sendDriverCredentialsEmail(driverName: string, driverEmail: string, password: string): Promise<void> {
  const transporter = getTransporter();
  const fromAddress = user!;
  const schoolName = "SafeRoute School Bus Tracker";

  const message = {
    from: `${schoolName} <${fromAddress}>`,
    to: driverEmail,
    subject: `Your ${schoolName} driver account is ready`,
    headers: {
      "X-Mailer": schoolName,
      "Message-ID": `<${randomUUID()}@saferoute.school>`,
      "List-Unsubscribe": `<mailto:${fromAddress}?subject=unsubscribe>`,
    },
    text: `Hello ${driverName},

Welcome to the ${schoolName}. A driver account has been created for you so you can manage trips, log GPS positions, and mark student boarding.

Your login credentials:
  Username: ${driverEmail}
  Temporary password: ${password}

To get started, visit your school's login page and select the Driver tab, then sign in with the credentials above. You will be asked to set a new password on your first login.

If you did not expect this email, please contact your school administrator.

Best regards,
The ${schoolName} team`,
    html: `
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
              To get started, visit your school's login page and select the <strong>Driver</strong> tab, then sign in with the credentials above. You will be asked to set a new password on your first login.
            </p>
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
</html>`,
  };

  await transporter.sendMail(message);
}
