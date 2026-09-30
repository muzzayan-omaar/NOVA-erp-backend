// Staff IDs are what a cashier types at a shared till — short, typeable,
// and globally unique so a Store Code + Staff ID pair can never be
// ambiguous. Same collision-checked pattern as Business Codes.
export const generateStaffIdBase = () => {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `STF${digits}`;
};

export const generateUniqueStaffId = async (prisma) => {
  let attempts = 0;

  while (attempts < 10) {
    const candidate = generateStaffIdBase();
    const existing = await prisma.employeeProfile.findUnique({ where: { staffId: candidate } });
    if (!existing) return candidate;
    attempts++;
  }

  return `STF${Date.now().toString().slice(-6)}`;
};