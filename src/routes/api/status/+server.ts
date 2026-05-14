import { json } from '@sveltejs/kit';
import { getWorkerState } from '$lib/server/flyio';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ workerState: await getWorkerState() });
};
