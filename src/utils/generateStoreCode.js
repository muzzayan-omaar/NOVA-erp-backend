export const generateStoreCodeBase = (storeName) => {
  const cleaned = storeName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = cleaned.slice(0, 5) || "STORE";
  const digits = Math.floor(100 + Math.random() * 900);
  return `${prefix}${digits}`;
};

export const generateUniqueStoreCode = async (prisma, storeName) => {
  let attempts = 0;

  while (attempts < 10) {
    const candidate = generateStoreCodeBase(storeName);
    const existing = await prisma.store.findUnique({ where: { storeCode: candidate } });
    if (!existing) return candidate;
    attempts++;
  }

  return `STR${Date.now().toString().slice(-6)}`;
};