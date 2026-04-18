import { logger } from '$lib/server/logger';

logger.info('App started');

process.on('SIGTERM', () => {
	// Give DB write up to 3s, then exit regardless
	const timeout = setTimeout(() => process.exit(0), 3000);
	logger.info('App shutting down')
		.catch(() => {})
		.finally(() => {
			clearTimeout(timeout);
			process.exit(0);
		});
});
