import 'dotenv/config';
import { pollFlightStatuses } from './poller.js';

const STATUS_INTERVAL_MS = 10 * 60 * 1000; // 10 min — AeroAPI free tier: 500 req/month

console.log('[worker] starting flight tracker worker');

(async () => {
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
