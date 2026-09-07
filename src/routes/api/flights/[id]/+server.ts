import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	ApiValidationError,
	parseUpdateFlightInput,
	readJsonObject,
} from '$lib/server/apiValidation';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const flight = await db.trackedFlight.findUnique({ where: { id: params.id } });
	if (!flight) throw error(404, 'Flight not found');

	let input;
	try {
		input = parseUpdateFlightInput(await readJsonObject(request));
	} catch (err) {
		if (err instanceof ApiValidationError) {
			return json({ error: err.message }, { status: 400 });
		}
		throw err;
	}

	const updated = await db.trackedFlight.update({
		where: { id: params.id },
		data: { label: input.label },
	});

	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const flight = await db.trackedFlight.findUnique({ where: { id: params.id } });
	if (!flight) throw error(404, 'Flight not found');

	await db.trackedFlight.delete({ where: { id: params.id } });
	return json({ success: true });
};
