import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { pollOneFlight } from '$lib/server/poll';
import { startWorker } from '$lib/server/flyio';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const flights = await db.trackedFlight.findMany({
		include: { status: true },
		orderBy: { createdAt: 'desc' },
	});
	return json(flights);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const flightId: string = body.flightId;
	const date: string = body.date;
	const label: string | undefined = body.label;

	if (!flightId?.trim() || !date) {
		return json({ error: 'flightId and date are required' }, { status: 400 });
	}

	const flight = await db.trackedFlight.create({
		data: {
			flightId: flightId.toUpperCase().replace(/\s+/g, ''),
			date: new Date(date),
			label: label?.trim() || null,
		},
	});

	// Immediately fetch status from AeroAPI so the card shows data right away
	try {
		await pollOneFlight(flight.id);
	} catch (err) {
		console.error('[api] initial poll failed:', err);
	}

	// Start the worker if it's stopped
	startWorker().catch((err) => console.error('[api] startWorker failed:', err));

	const updated = await db.trackedFlight.findUnique({
		where: { id: flight.id },
		include: { status: true },
	});

	return json(updated, { status: 201 });
};
