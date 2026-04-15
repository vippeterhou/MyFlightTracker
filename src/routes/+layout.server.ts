import { db } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

const TERMINAL = ['arrived', 'cancelled'];

export const load: LayoutServerLoad = async () => {
	const [last, activeCount] = await Promise.all([
		db.flightStatus.findFirst({
			orderBy: { lastChecked: 'desc' },
			select: { lastChecked: true },
		}),
		db.trackedFlight.count({
			where: { status: { status: { notIn: TERMINAL } } },
		}),
	]);
	return {
		lastChecked: last?.lastChecked ?? null,
		activeCount,
	};
};
