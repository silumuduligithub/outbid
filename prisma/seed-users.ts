import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const demoUsers = [
    { email: 'test@gmail.com', username: 'testuser', countryCode: 'US' },
    { email: 'demo@worldbid.app', username: 'apex_commander', countryCode: 'US' },
    { email: 'commander@worldbid.app', username: 'global_patriot', countryCode: 'IN' },
  ];

  for (const u of demoUsers) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      const user = await prisma.user.create({
        data: {
          email: u.email,
          username: u.username,
          passwordHash,
          countryCode: u.countryCode,
          role: 'USER',
        },
      });
      console.log('Created demo user:', user.email, 'password: password123');
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
      console.log('Updated demo user password for:', u.email, 'to: password123');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
