import { db } from '$lib/server/db';
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

export interface ActiveFlight {
	id: string;
	flightId: string;
	label: string | null;
	date: string;
	status: string | null;
	statusChangedAt: string | null;
	departureAirport: string | null;
	arrivalAirport: string | null;
	scheduledDep: string | null;
	estimatedDep: string | null;
	actualDep: string | null;
	scheduledArr: string | null;
	estimatedArr: string | null;
}

const TERMINAL_STATUSES = ['arrived', 'cancelled'];

export const load: PageServerLoad = async () => {
	const content = Promise.all([
		db.pollLog.findMany({ orderBy: { timestamp: 'desc' }, take: 200 }),
		db.trackedFlight.findMany({
			where: {
				OR: [
					{ status: { is: null } },
					{ status: { status: { notIn: TERMINAL_STATUSES } } },
				],
			},
			select: {
				id: true,
				flightId: true,
				label: true,
				date: true,
				status: {
					select: {
						status: true,
						statusChangedAt: true,
						departureAirport: true,
						arrivalAirport: true,
						scheduledDep: true,
						estimatedDep: true,
						actualDep: true,
						scheduledArr: true,
						estimatedArr: true,
					},
				},
			},
			orderBy: { date: 'asc' },
		}),
		db.workerHeartbeat.findUnique({ where: { id: 'worker' } }),
	]).then(([logs, incomplete, heartbeat]) => {
		const activeFlights: ActiveFlight[] = incomplete.map((f) => ({
			id: f.id,
			flightId: f.flightId,
			label: f.label,
			date: f.date.toISOString(),
			status: f.status?.status ?? null,
			statusChangedAt: f.status?.statusChangedAt?.toISOString() ?? null,
			departureAirport: f.status?.departureAirport ?? null,
			arrivalAirport: f.status?.arrivalAirport ?? null,
			scheduledDep: f.status?.scheduledDep?.toISOString() ?? null,
			estimatedDep: f.status?.estimatedDep?.toISOString() ?? null,
			actualDep: f.status?.actualDep?.toISOString() ?? null,
			scheduledArr: f.status?.scheduledArr?.toISOString() ?? null,
			estimatedArr: f.status?.estimatedArr?.toISOString() ?? null,
		}));

		return {
			logs: JSON.parse(JSON.stringify(logs)) as SerializedLog[],
			activeFlights,
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
