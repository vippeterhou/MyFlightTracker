import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [flights, lastStatus] = await Promise.all([
		db.trackedFlight.findMany({ include: { status: true } }),
		db.flightStatus.findFirst({ orderBy: { lastChecked: 'desc' }, select: { lastChecked: true } }),
	]);
	return { flights, lastChecked: lastStatus?.lastChecked ?? null };
};
