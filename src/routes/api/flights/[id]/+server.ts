import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const flight = await db.trackedFlight.findUnique({ where: { id: params.id } });
	if (!flight) throw error(404, 'Flight not found');

	const body = await request.json();
	const label = typeof body.label === 'string' ? body.label.trim() || null : null;

	const updated = await db.trackedFlight.update({
		where: { id: params.id },
		data: { label },
	});

	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const flight = await db.trackedFlight.findUnique({ where: { id: params.id } });
	if (!flight) throw error(404, 'Flight not found');

	await db.trackedFlight.delete({ where: { id: params.id } });
	return json({ success: true });
};
