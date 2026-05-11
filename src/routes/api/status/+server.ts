import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getWorkerState } from '$lib/server/flyio';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const [last, workerState] = await Promise.all([
		db.flightStatus.findFirst({
			orderBy: { lastChecked: 'desc' },
			select: { lastChecked: true },
		}),
		getWorkerState(),
	]);
	return json({
		lastChecked: last?.lastChecked ?? null,
		workerState,
	});
};
