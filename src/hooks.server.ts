import { logger } from '$lib/server/logger';

logger.info('App started');

process.on('SIGTERM', async () => {
	await logger.info('App shutting down');
	process.exit(0);
});
