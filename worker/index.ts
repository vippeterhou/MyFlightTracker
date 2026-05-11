import 'dotenv/config';
import { pollFlightStatuses } from './poller.js';
import { logger } from '../src/lib/server/logger.js';

const STATUS_INTERVAL_MS = 10 * 60 * 1000; // 10 min — AeroAPI free tier: 500 req/month

(async () => {
	await logger.info('Worker started');

	while (true) {
		try {
			await pollFlightStatuses();
		} catch (err) {
			await logger.error(`Poll failed: ${(err as Error).message}`);
		}
		await sleep(STATUS_INTERVAL_MS);
	}
})();

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}
