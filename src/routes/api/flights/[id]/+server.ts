import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	const flight = await db.trackedFlight.findUnique({ where: { id: params.id } });
	if (!flight) throw error(404, 'Flight not found');

	await db.trackedFlight.delete({ where: { id: params.id } });
	return json({ success: true });
};
