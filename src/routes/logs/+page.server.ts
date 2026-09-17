import { db } from '$lib/server/db';
import { POLL_SNAPSHOT } from '$lib/constants';
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
	const content = Promise.all([
		db.pollLog.findMany({ orderBy: { timestamp: 'desc' }, take: 200 }),
		db.pollLog.findMany({
			where: {
				OR: [
					{ message: { startsWith: POLL_SNAPSHOT.PREFIX } },
					{ message: 'Flight added' },
				],
			},
			orderBy: { timestamp: 'desc' },
			take: 30,
		}),
		db.workerHeartbeat.findUnique({ where: { id: 'worker' } }),
	]).then(([logs, activity, heartbeat]) => {
		return {
			logs: JSON.parse(JSON.stringify(logs)) as SerializedLog[],
			activity: JSON.parse(JSON.stringify(activity)) as SerializedLog[],
			lastCheckedAt: heartbeat?.lastRunAt?.toISOString() ?? null,
		};
	});

	// Streamed (returned unawaited): the route map pulls every flight's ~1 MB of
	// track points, so we let the page shell + logs render first and fill the map
	// in once this resolves. SvelteKit 2 streams top-level promises we don't await.
	const routes: Promise<FlightRoute[]> = db.trackedFlight
		.findMany({
			where: { status: { trackData: { not: { equals: null } } } },
			include: { status: true },
			orderBy: { date: 'desc' },
		})
		.then((flightsWithTrack) =>
			flightsWithTrack
				.filter(
					(f) => Array.isArray(f.status?.trackData) && (f.status!.trackData as unknown[]).length > 0,
				)
				.map((f) => ({
					flightId: f.flightId,
					label: f.label,
					date: f.date.toISOString(),
					departureAirport: f.status!.departureAirport,
					arrivalAirport: f.status!.arrivalAirport,
					track: (f.status!.trackData as { lat: number; lon: number; heading: number }[]).map(
						(p) => ({ lat: p.lat, lon: p.lon, heading: p.heading }),
					),
				})),
		);

	return {
		content,
		routes,
	};
};
