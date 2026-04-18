import { db } from '$lib/server/db';
import { logger } from '$lib/server/logger';

const last = await db.pollLog.findFirst({
	where: { message: { startsWith: 'App started' } },
	orderBy: { timestamp: 'desc' },
});

const reason = last ? 'woke from suspension' : 'first boot';
logger.info(`App started (${reason}) — will auto-suspend after ~5 min of inactivity (shutdown not logged)`);
