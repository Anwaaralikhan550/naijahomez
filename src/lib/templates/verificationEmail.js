export function buildVerificationEmailTemplate({
  displayName = '',
  verificationUrl,
  expiresInHours = 24
}) {
  const safeName = displayName?.trim() || 'there';

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email - NaijaHomz</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#1d4ed8;padding:20px 24px;">
                <div style="font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;">NaijaHomz</div>
                <div style="font-size:13px;line-height:1.5;color:#dbeafe;margin-top:4px;">Property, marketplace and community platform</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;">
                <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;color:#111827;">Verify your email address</h1>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#374151;">Hello ${safeName},</p>
                <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#374151;">
                  Thanks for signing up. Confirm your email to activate full access to your NaijaHomz account.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
                  <tr>
                    <td align="center" style="border-radius:8px;background:#2563eb;">
                      <a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                        Verify Email
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  If the button does not work, copy and paste this link:
                </p>
                <p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;word-break:break-all;color:#2563eb;">
                  ${verificationUrl}
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
                  This link expires in ${expiresInHours} hours.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#6b7280;">
                  Need help? Contact support at
                  <a href="mailto:support@naijahomz.com" style="color:#2563eb;text-decoration:none;">support@naijahomz.com</a>.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">NaijaHomz • Secure account verification</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const text = [
    'NaijaHomz - Verify your email address',
    '',
    `Hello ${safeName},`,
    '',
    'Confirm your email to activate full access to your NaijaHomz account.',
    '',
    `Verify Email: ${verificationUrl}`,
    '',
    `This link expires in ${expiresInHours} hours.`,
    '',
    'Need help? support@naijahomz.com'
  ].join('\n');

  return { html, text };
}

