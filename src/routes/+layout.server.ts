import { getWorkerState } from '$lib/server/flyio';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	return { workerState: await getWorkerState() };
};
