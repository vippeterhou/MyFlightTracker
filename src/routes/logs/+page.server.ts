import { db } from '$lib/server/db';
import { getWorkerState } from '$lib/server/flyio';
import type { PageServerLoad } from './$types';

type SerializedLog = { id: string; timestamp: string; level: string; flightId: string | null; message: string };

export const load: PageServerLoad = async () => {
	const [logs, workerState] = await Promise.all([
		db.pollLog.findMany({ orderBy: { timestamp: 'desc' }, take: 200 }),
		getWorkerState(),
	]);
	return {
		logs: JSON.parse(JSON.stringify(logs)) as SerializedLog[],
		workerState,
	};
};
