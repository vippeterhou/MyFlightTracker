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

	const faId = flight.status?.faFlightId;
	const track: Promise<TrackPoint[]> =
		faId && MAP_STATUSES.has(flight.status?.status ?? '')
			? getFlightTrack(faId).catch(() => [])
			: Promise.resolve([]);

	return { flight: JSON.parse(JSON.stringify(flight)), track };
};
