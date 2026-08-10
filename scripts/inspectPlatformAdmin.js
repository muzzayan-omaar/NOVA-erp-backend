import prisma from "../src/lib/prisma.js";

const run = async () => {
  const admins = await prisma.platformAdmin.findMany();

  if (admins.length === 0) {
    console.log("No platform admin records found at all.");
  }

  admins.forEach((a) => {
    // JSON.stringify renders a trailing \r or \n as a visible "\r"/"\n"
    // in the output — invisible in Prisma Studio's table, obvious here.
    console.log(JSON.stringify({ id: a.id, name: a.name, email: a.email }));
  });

  process.exit(0);
};

run();