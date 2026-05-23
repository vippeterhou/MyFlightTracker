import { db } from '$lib/server/db';
import { getFlightTrack, type TrackPoint } from '$lib/server/aeroapi';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const MAP_STATUSES = new Set(['departed', 'airborne', 'landed', 'arrived', 'diverted']);

export const load: PageServerLoad = async ({ params }) => {
	const flight = await db.trackedFlight.findUnique({
		where: { id: params.id },
		include: { status: true },
	});

	if (!flight) throw error(404, 'Flight not found');

	// Use cached track data from DB if available, otherwise fetch from AeroAPI
	const cached = flight.status?.trackData as TrackPoint[] | null;
	let track: Promise<TrackPoint[]> | TrackPoint[];

	if (cached && cached.length > 0) {
		track = cached;
	} else {
		const faId = flight.status?.faFlightId;
		if (faId && MAP_STATUSES.has(flight.status?.status ?? '')) {
			track = getFlightTrack(faId).catch(() => []);
		} else {
			track = Promise.resolve([]);
		}
	}

	return { flight: JSON.parse(JSON.stringify(flight)), track };
};
