import prisma from "../lib/prisma.js";

// GET /api/support/threads
export const getMyThreads = async (req, res) => {
  try {
    const threads = await prisma.supportThread.findMany({
      where: { companyId: req.context.companyId },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    const withFlags = threads.map((t) => {
      const latest = t.messages[0];
      return {
        id: t.id,
        subject: t.subject,
        status: t.status,
        lastMessageAt: t.lastMessageAt,
        lastMessagePreview: latest?.body?.slice(0, 100) || "",
        hasNewReply: Boolean(latest?.senderPlatformAdminId),
      };
    });

    res.json(withFlags);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch support threads" });
  }
};

// POST /api/support/threads
export const createThread = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const { companyId, userId } = req.context;

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }

    const thread = await prisma.supportThread.create({
      data: {
        companyId,
        subject,
        messages: {
          create: { senderUserId: userId, body: message },
        },
      },
      include: { messages: true },
    });

    res.status(201).json(thread);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create thread" });
  }
};

// GET /api/support/threads/:id
export const getThreadMessages = async (req, res) => {
  try {
    const { id } = req.params;

    const thread = await prisma.supportThread.findFirst({
      where: { id, companyId: req.context.companyId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            senderUser: { select: { id: true, name: true } },
            senderPlatformAdmin: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!thread) return res.status(404).json({ message: "Thread not found" });

    res.json(thread);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch thread" });
  }
};

// POST /api/support/threads/:id/reply
export const replyToThread = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const { companyId, userId } = req.context;

    if (!message) return res.status(400).json({ message: "Message is required" });

    const thread = await prisma.supportThread.findFirst({ where: { id, companyId } });
    if (!thread) return res.status(404).json({ message: "Thread not found" });

    await prisma.supportMessage.create({
      data: { threadId: id, senderUserId: userId, body: message },
    });

    await prisma.supportThread.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        status: thread.status === "CLOSED" ? "OPEN" : thread.status,
      },
    });

    res.status(201).json({ message: "Reply sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send reply" });
  }
};
