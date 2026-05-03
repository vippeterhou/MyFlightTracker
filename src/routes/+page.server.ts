import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const flights = await db.trackedFlight.findMany({ include: { status: true } });
	return { flights: JSON.parse(JSON.stringify(flights)) };
};
