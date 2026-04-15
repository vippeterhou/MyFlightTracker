import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const MAX_LOGS = 500;

async function write(level: string, message: string, flightId?: string | null) {
	console.log(`[${level}] ${message}`);
	await db.pollLog.create({ data: { level, message, flightId: flightId ?? null } });
	// Prune old logs beyond MAX_LOGS
	const count = await db.pollLog.count();
	if (count > MAX_LOGS) {
		const oldest = await db.pollLog.findMany({
			orderBy: { timestamp: 'asc' },
			take: count - MAX_LOGS,
			select: { id: true },
		});
		await db.pollLog.deleteMany({ where: { id: { in: oldest.map((l) => l.id) } } });
	}
}

export const logger = {
	info:  (message: string, flightId?: string | null) => write('info',  message, flightId),
	warn:  (message: string, flightId?: string | null) => write('warn',  message, flightId),
	error: (message: string, flightId?: string | null) => write('error', message, flightId),
};
