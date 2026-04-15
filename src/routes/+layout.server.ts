import { db } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const last = await db.flightStatus.findFirst({
		orderBy: { lastChecked: 'desc' },
		select: { lastChecked: true },
	});
	return { lastChecked: last?.lastChecked ?? null };
};
