import nodemailer from "nodemailer";

const isConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;

const getTransporter = () => {
  if (!isConfigured()) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
};

// Returns { sent: boolean, reason?: string } — never throws, so callers
// can decide what to do next instead of the whole request failing.
export const sendEmail = async ({ to, subject, html }) => {
  const t = getTransporter();

  if (!t) {
    console.warn("Email not configured — skipping send to", to);
    return { sent: false, reason: "EMAIL_NOT_CONFIGURED" };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("Email send failed:", err.message);
    return { sent: false, reason: "SEND_FAILED" };
  }
};