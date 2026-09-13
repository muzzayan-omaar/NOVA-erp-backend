import prisma from "../lib/prisma.js";
import { generateDailySnapshot } from "../services/backupService.js";
import { sendEmail } from "../utils/mailer.js";

// Sends today's real business snapshot to every active company's General
// Manager(s). If the whole cloud stack disappeared tomorrow, whoever
// received this email still has today's real numbers in their inbox.
//
// Honest limitation: this runs in-process via node-cron. If the server
// happens to restart at the exact scheduled minute, that day's automatic
// run can be skipped — the manual "Send Backup Now" trigger exists
// specifically to cover that gap, not as a replacement for it.
export const runDailyBackupJob = async () => {
  console.log("[BACKUP JOB] Starting daily snapshot run:", new Date().toISOString());

  try {
    const companies = await prisma.company.findMany({
      where: {
        isActive: true,
        subscription: { status: { in: ["ACTIVE", "TRIALING"] } },
      },
    });

    for (const company of companies) {
      try {
        const gms = await prisma.user.findMany({
          where: { companyId: company.id, role: "GENERAL_MANAGER", isActive: true },
          select: { email: true, name: true },
        });

        if (gms.length === 0) {
          console.log(`[BACKUP JOB] Skipping ${company.name} — no active GM to send to`);
          continue;
        }

        const snapshot = await generateDailySnapshot(company.id);

        for (const gm of gms) {
          const result = await sendEmail({
            to: gm.email,
            subject: `Nova ERP — ${company.name} Daily Backup (${new Date().toDateString()})`,
            html: `
              <p>Hello ${gm.name},</p>
              <p>Here is today's business snapshot for ${company.name}, attached as an Excel file.</p>
              <ul>
                <li>Revenue today: UGX ${snapshot.summary.totalRevenue.toLocaleString()}</li>
                <li>Expenses today: UGX ${snapshot.summary.totalExpenses.toLocaleString()}</li>
                <li>Transactions: ${snapshot.summary.transactionCount}</li>
                <li>Low stock items: ${snapshot.summary.lowStockCount}</li>
              </ul>
              <p>Keep this email — it's a real, independent copy of today's records.</p>
            `,
            attachments: [
              {
                filename: snapshot.filename,
                content: snapshot.buffer,
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              },
            ],
          });

          console.log(`[BACKUP JOB] ${company.name} -> ${gm.email}: ${result.sent ? "sent" : "failed (" + result.reason + ")"}`);
        }
      } catch (companyErr) {
        console.error(`[BACKUP JOB] Failed for company ${company.name}:`, companyErr.message);
      }
    }

    console.log("[BACKUP JOB] Run complete");
  } catch (err) {
    console.error("[BACKUP JOB] Fatal error:", err.message);
  }
};