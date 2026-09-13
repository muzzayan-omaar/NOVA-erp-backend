import { generateDailySnapshot } from "../services/backupService.js";
import prisma from "../lib/prisma.js";
import { sendEmail } from "../utils/mailer.js";
import createAuditLog from "../services/auditService.js";

// POST /api/backup/send-now — lets a GM request today's snapshot on
// demand, both for testing and as a real "send it to me right now" option.
export const triggerBackupNow = async (req, res) => {
  try {
    const { companyId, userId } = req.context;

    const requester = await prisma.user.findUnique({ where: { id: userId } });
    const snapshot = await generateDailySnapshot(companyId);

    const result = await sendEmail({
      to: requester.email,
      subject: `Nova ERP — ${snapshot.companyName} Backup (requested)`,
      html: `
        <p>Hello ${requester.name},</p>
        <p>Here is your requested business snapshot, attached as an Excel file.</p>
        <ul>
          <li>Revenue today: UGX ${snapshot.summary.totalRevenue.toLocaleString()}</li>
          <li>Expenses today: UGX ${snapshot.summary.totalExpenses.toLocaleString()}</li>
          <li>Transactions: ${snapshot.summary.transactionCount}</li>
          <li>Low stock items: ${snapshot.summary.lowStockCount}</li>
        </ul>
      `,
      attachments: [
        {
          filename: snapshot.filename,
          content: snapshot.buffer,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    await createAuditLog({
      userId,
      companyId,
      storeId: req.context.storeId,
      action: "BACKUP_REQUESTED",
      entityType: "backup",
      entityId: companyId,
      metadata: { emailSent: result.sent, reason: result.reason },
    });

    if (!result.sent) {
      return res.status(200).json({
        message: "Snapshot generated, but email isn't configured on this server yet — nothing was sent.",
        emailSent: false,
      });
    }

    res.json({ message: `Sent to ${requester.email}`, emailSent: true });
  } catch (err) {
    console.error("BACKUP TRIGGER ERROR:", err);
    res.status(500).json({ message: "Failed to generate backup" });
  }
};