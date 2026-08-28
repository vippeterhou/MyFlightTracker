import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

// Returns a single flight's persisted track points from the DB (no AeroAPI call).
// The dashboard lazy-loads this only when a route map is actually rendered, so the
// initial page load doesn't have to ship every flight's track blob.
export const GET: RequestHandler = async ({ params }) => {
	const status = await db.flightStatus.findUnique({
		where: { trackedFlightId: params.id },
		select: { trackData: true },
	});
	const track = Array.isArray(status?.trackData) ? status.trackData : [];
	return json({ track });
};
