import { db } from '$lib/server/db';
import { getWorkerState } from '$lib/server/flyio';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const [last, workerState] = await Promise.all([
		db.flightStatus.findFirst({
			orderBy: { lastChecked: 'desc' },
			select: { lastChecked: true },
		}),
		getWorkerState(),
	]);
	return {
		lastChecked: last?.lastChecked ?? null,
		workerState,
	};
};
