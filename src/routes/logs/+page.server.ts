import { db } from '$lib/server/db';
import { getWorkerState } from '$lib/server/flyio';
import type { PageServerLoad } from './$types';

type SerializedLog = { id: string; timestamp: string; level: string; flightId: string | null; message: string };

export interface FlightRoute {
	flightId: string;
	label: string | null;
	date: string;
	departureAirport: string | null;
	arrivalAirport: string | null;
	track: { lat: number; lon: number; heading: number }[];
}

export const load: PageServerLoad = async () => {
	const [logs, workerState, flightsWithTrack] = await Promise.all([
		db.pollLog.findMany({ orderBy: { timestamp: 'desc' }, take: 200 }),
		getWorkerState(),
		db.trackedFlight.findMany({
			where: { status: { trackData: { not: { equals: null } } } },
			include: { status: true },
			orderBy: { date: 'desc' },
		}),
	]);

	const routes: FlightRoute[] = flightsWithTrack
		.filter((f) => Array.isArray(f.status?.trackData) && (f.status!.trackData as unknown[]).length > 0)
		.map((f) => ({
			flightId: f.flightId,
			label: f.label,
			date: f.date.toISOString(),
			departureAirport: f.status!.departureAirport,
			arrivalAirport: f.status!.arrivalAirport,
			track: (f.status!.trackData as { lat: number; lon: number; heading: number }[]).map((p) => ({
				lat: p.lat,
				lon: p.lon,
				heading: p.heading,
			})),
		}));

	return {
		logs: JSON.parse(JSON.stringify(logs)) as SerializedLog[],
		workerState,
		routes,
	};
};
