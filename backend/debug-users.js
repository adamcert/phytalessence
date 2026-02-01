const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ take: 10 });
  console.log('Users avec nft_id:');
  users.forEach(u => console.log('  -', u.email, '| nft_id:', u.nftId || 'NULL'));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
