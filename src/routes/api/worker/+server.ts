import { json, error } from '@sveltejs/kit';
import { getWorkerState, startWorker, stopWorker } from '$lib/server/flyio';
import { logger } from '$lib/server/logger';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const state = await getWorkerState();
	return json({ state });
};

export const POST: RequestHandler = async () => {
	try {
		await startWorker();
	} catch (err) {
		error(502, (err as Error).message);
	}
	await logger.info('Worker started via UI');
	const state = await getWorkerState();
	return json({ state });
};

export const DELETE: RequestHandler = async () => {
	try {
		await stopWorker();
	} catch (err) {
		error(502, (err as Error).message);
	}
	await logger.info('Worker stopped via UI');
	const state = await getWorkerState();
	return json({ state });
};
