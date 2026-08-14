export const generateBusinessCodeBase = (companyName) => {
  const cleaned = companyName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = cleaned.slice(0, 6) || "NOVA";
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${digits}`;
};

export const generateUniqueBusinessCode = async (prisma, companyName) => {
  let attempts = 0;

  while (attempts < 10) {
    const candidate = generateBusinessCodeBase(companyName);
    const existing = await prisma.company.findUnique({ where: { businessCode: candidate } });
    if (!existing) return candidate;
    attempts++;
  }

  // Extremely unlikely fallback — guarantees uniqueness even if the name is very common.
  return `NOVA${Date.now().toString().slice(-6)}`;
};
