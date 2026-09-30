import prisma from "../src/lib/prisma.js";
import { generateUniqueStaffId } from "../src/utils/generateStaffId.js";

// Every existing user needs an EmployeeProfile with a Staff ID, or nobody
// currently in the system could log in once login switches over. Only the
// Staff ID is filled in — everything else on the profile stays empty until
// a GM edits it, exactly as if the fields had simply never been entered.
const run = async () => {
  const users = await prisma.user.findMany({
    where: { employeeProfile: null },
    select: { id: true, name: true, role: true },
  });

  for (const u of users) {
    const staffId = await generateUniqueStaffId(prisma);
    await prisma.employeeProfile.create({ data: { userId: u.id, staffId } });
    console.log(`${u.name} (${u.role}) -> ${staffId}`);
  }

  console.log(`Backfilled ${users.length} users`);
  process.exit(0);
};

run();