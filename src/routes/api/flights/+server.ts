import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	applyInitialFlightMatch,
	findInitialFlightMatches,
} from '$lib/server/poll';
import { logger } from '$lib/server/logger';
import {
	buildNotificationSubject,
	sendNotifications,
} from '$lib/server/notifications';
import {
	ApiValidationError,
	parseCreateFlightInput,
	readJsonObject,
} from '$lib/server/apiValidation';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const flights = await db.trackedFlight.findMany({
		include: { status: true },
		orderBy: { createdAt: 'desc' },
	});
	return json(flights);
};

export const POST: RequestHandler = async ({ request }) => {
	let input;
	try {
		input = parseCreateFlightInput(await readJsonObject(request));
	} catch (err) {
		if (err instanceof ApiValidationError) {
			return json({ error: err.message }, { status: 400 });
		}
		throw err;
	}

	let matches;
	try {
		matches = await findInitialFlightMatches(input.flightId, input.date);
	} catch (err) {
		await logger.error(
			`Initial flight lookup failed: ${(err as Error).message}`,
			input.flightId,
		);
		return json({ error: 'Unable to look up this flight right now' }, { status: 502 });
	}

	if (matches.length > 1 && !input.selectedCandidateId) {
		return json(
			{
				requiresSelection: true,
				candidates: matches.map((match) => match.candidate),
			},
			{ status: 409 },
		);
	}

	const selectedMatch = input.selectedCandidateId
		? matches.find((match) => match.candidate.id === input.selectedCandidateId)
		: matches[0];
	if (input.selectedCandidateId && !selectedMatch) {
		return json({ error: 'The selected flight segment is no longer available' }, { status: 400 });
	}

	const flight = await db.trackedFlight.create({
		data: {
			flightId: input.flightId,
			date: input.date,
			label: input.label,
		},
	});

	await logger.info(`Flight added`, flight.flightId);
	const tag = flight.label ? `${flight.flightId} · ${flight.label}` : flight.flightId;
	sendNotifications(
		buildNotificationSubject(flight.flightId, 'tracking-started', flight.label),
		`📋 <b>[${tag}] Tracking started</b>`,
		flight.flightId,
	).catch((err: Error) =>
		logger.warn(`Notification dispatch failed: ${err.message}`, flight.flightId)
	);

	if (selectedMatch) {
		try {
			await applyInitialFlightMatch(flight.id, selectedMatch);
		} catch (err) {
			await logger.error(
				`Initial status save failed: ${(err as Error).message}`,
				flight.flightId,
			);
		}
	}

	const updated = await db.trackedFlight.findUnique({
		where: { id: flight.id },
		include: { status: true },
	});

	return json(updated, { status: 201 });
};
