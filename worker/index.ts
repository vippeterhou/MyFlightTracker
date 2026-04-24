import 'dotenv/config';
import { pollFlightStatuses } from './poller.js';
import { logger } from '../src/lib/server/logger.js';

const STATUS_INTERVAL_MS = 10 * 60 * 1000; // 10 min — AeroAPI free tier: 500 req/month

(async () => {
	await logger.info('Worker started — will shut down when no active flights remain');

	while (true) {
		try {
			await pollFlightStatuses();
		} catch (err) {
			console.error('[worker] status poll failed:', err);
		}
		await sleep(STATUS_INTERVAL_MS);
	}
})();

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}
