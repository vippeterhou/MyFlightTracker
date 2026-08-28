import 'dotenv/config';
import { pollFlightStatuses, recordHeartbeat } from './poller.js';
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
		// Record liveness after every cycle (even a failed/empty one) so the UI can
		// tell the worker is running independent of whether any flight was polled.
		try {
			await recordHeartbeat();
		} catch (err) {
			await logger.error(`Heartbeat failed: ${(err as Error).message}`);
		}
		await sleep(STATUS_INTERVAL_MS);
	}
})();

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}
