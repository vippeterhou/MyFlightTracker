import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

type SerializedLog = { id: string; timestamp: string; level: string; flightId: string | null; message: string };

export const load: PageServerLoad = async () => {
	const logs = await db.pollLog.findMany({
		orderBy: { timestamp: 'desc' },
		take: 200,
	});
	return { logs: JSON.parse(JSON.stringify(logs)) as SerializedLog[] };
};
