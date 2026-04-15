import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const logs = await db.pollLog.findMany({
		orderBy: { timestamp: 'desc' },
		take: 200,
	});
	return { logs };
};
