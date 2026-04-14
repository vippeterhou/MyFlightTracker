import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const flight = await db.trackedFlight.findUnique({
		where: { id: params.id },
		include: { status: true },
	});

	if (!flight) throw error(404, 'Flight not found');

	return { flight };
};
