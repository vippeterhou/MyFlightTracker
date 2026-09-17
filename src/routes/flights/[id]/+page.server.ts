import { db } from '$lib/server/db';
import { getFlightTrack, type TrackPoint } from '$lib/server/aeroapi';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const TRACK_FETCH_STATUSES = new Set(['airborne', 'landed', 'arrived', 'diverted']);

export const load: PageServerLoad = async ({ params }) => {
	const flight = db.trackedFlight.findUnique({
		where: { id: params.id },
		include: { status: true },
	}).then((result) => {
		if (!result) throw error(404, 'Flight not found');
		return result;
	});

	const serializedFlight = flight.then((result) => JSON.parse(JSON.stringify(result)));
	const track = flight.then(async (result) => {
		const cached = result.status?.trackData as TrackPoint[] | null;
		if (cached && cached.length > 0) return cached;

		const faId = result.status?.faFlightId;
		if (faId && TRACK_FETCH_STATUSES.has(result.status?.status ?? '')) {
			return getFlightTrack(faId, result.flightId).catch(() => []);
		}
		return [];
	});

	return { flight: serializedFlight, track };
};
