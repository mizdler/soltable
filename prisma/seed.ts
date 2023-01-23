import { PrismaClient } from "prisma/prisma-client";
const prisma = new PrismaClient();


async function main() {
	await prisma.checkpoint.upsert({
		where: { key: 'LAST_SOLANA_SIG' },
		update: { sig: null },
		create: { key: 'LAST_SOLANA_SIG', sig: null }
	});

	await prisma.checkpoint.upsert({
		where: { key: 'FIRST_SOLANA_SIG' },
		update: { sig: null },
		create: { key: 'FIRST_SOLANA_SIG', sig: null }
	});
}

main().then(async () => {
	await prisma.$disconnect();
}).catch(async (e) => {
	console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});