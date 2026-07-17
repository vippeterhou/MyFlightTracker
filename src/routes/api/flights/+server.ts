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
	const selectedCandidateId: string | undefined = body.selectedCandidateId;

	if (!flightId?.trim() || !date) {
		return json({ error: 'flightId and date are required' }, { status: 400 });
	}

	const normalizedFlightId = flightId.toUpperCase().replace(/\s+/g, '');
	const flightDate = new Date(date);
	if (Number.isNaN(flightDate.getTime())) {
		return json({ error: 'date must be valid' }, { status: 400 });
	}

	let matches;
	try {
		matches = await findInitialFlightMatches(normalizedFlightId, flightDate);
	} catch (err) {
		await logger.error(
			`Initial flight lookup failed: ${(err as Error).message}`,
			normalizedFlightId,
		);
		return json({ error: 'Unable to look up this flight right now' }, { status: 502 });
	}

	if (matches.length > 1 && !selectedCandidateId) {
		return json(
			{
				requiresSelection: true,
				candidates: matches.map((match) => match.candidate),
			},
			{ status: 409 },
		);
	}

	const selectedMatch = selectedCandidateId
		? matches.find((match) => match.candidate.id === selectedCandidateId)
		: matches[0];
	if (selectedCandidateId && !selectedMatch) {
		return json({ error: 'The selected flight segment is no longer available' }, { status: 400 });
	}

	const flight = await db.trackedFlight.create({
		data: {
			flightId: normalizedFlightId,
			date: flightDate,
			label: label?.trim() || null,
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
