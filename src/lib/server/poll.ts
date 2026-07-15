import type { Prisma } from '@prisma/client';
import { db } from './db';
import { getFlightByIdent, getFlightSchedule, getFlightTrack, mapAeroStatus } from './aeroapi';
import { logger } from './logger';

export async function pollOneFlight(id: string): Promise<void> {
	const flight = await db.trackedFlight.findUnique({
		where: { id },
		include: { status: true },
	});
	if (!flight) return;

	// AeroAPI's live endpoint only has data ~2 days out. For flights further away, skip
	// the (guaranteed-empty) live call and go straight to published schedules for the route.
	const daysUntil = (flight.date.getTime() - Date.now()) / 86400000;
	if (daysUntil > 2) {
		await applyScheduleFallback(flight);
		return;
	}

	const aero = await getFlightByIdent(flight.flightId, flight.date);
	if (!aero) {
		// No live data yet — fall back to published schedules to at least show the route
		// (airport codes) and scheduled times.
		await applyScheduleFallback(flight);
		return;
	}

	const newStatus = mapAeroStatus(aero);

	let trackData = undefined;
	if (newStatus === 'arrived' && aero.fa_flight_id && !flight.status?.trackData) {
		try {
			const track = await getFlightTrack(aero.fa_flight_id, flight.flightId);
			if (track.length > 0) trackData = track;
		} catch (err) {
			await logger.warn(`Track fetch failed: ${(err as Error).message}`, flight.flightId);
		}
	}

	const shared = {
		status: newStatus,
		departureAirport: aero.origin?.code_iata ?? null,
		arrivalAirport: aero.destination?.code_iata ?? null,
		departureCity: aero.origin?.city ?? null,
		arrivalCity: aero.destination?.city ?? null,
		departureTz: aero.origin?.timezone ?? null,
		arrivalTz: aero.destination?.timezone ?? null,
		departureGate: aero.gate_origin ?? null,
		arrivalGate: aero.gate_destination ?? null,
		scheduledDep: aero.scheduled_out ? new Date(aero.scheduled_out) : null,
		estimatedDep: aero.estimated_out ? new Date(aero.estimated_out) : null,
		actualDep: aero.actual_out ? new Date(aero.actual_out) : null,
		wheelsOff: aero.actual_off ? new Date(aero.actual_off) : null,
		wheelsOn: aero.actual_on ? new Date(aero.actual_on) : null,
		scheduledArr: aero.scheduled_in ? new Date(aero.scheduled_in) : null,
		estimatedArr: aero.estimated_in ? new Date(aero.estimated_in) : null,
		actualArr: aero.actual_in ? new Date(aero.actual_in) : null,
		aircraftType: aero.aircraft_type ?? null,
		baggageClaim: aero.baggage_claim ?? null,
		faFlightId: aero.fa_flight_id ?? null,
		...(trackData ? { trackData: trackData as unknown as Prisma.InputJsonValue } : {}),
	};

	await db.flightStatus.upsert({
		where: { trackedFlightId: flight.id },
		create: {
			trackedFlightId: flight.id,
			boardingAt: newStatus === 'boarding' ? new Date() : null,
			...shared,
		},
		update: {
			lastChecked: new Date(),
			...shared,
		},
	});
}

type FlightWithStatus = NonNullable<
	Awaited<ReturnType<typeof db.trackedFlight.findUnique>>
> & { status: { departureAirport: string | null } | null };

// Populates route (airport codes) and scheduled times from published schedules for
// flights AeroAPI's live endpoint doesn't cover yet. Skips if the route is already
// known, so it runs at most once per flight and never overwrites live data.
async function applyScheduleFallback(flight: FlightWithStatus): Promise<void> {
	if (flight.status?.departureAirport) return;

	const sched = await getFlightSchedule(flight.flightId, flight.date);
	if (!sched) return;

	const shared = {
		status: 'scheduled',
		departureAirport: sched.origin_iata ?? sched.origin ?? null,
		arrivalAirport: sched.destination_iata ?? sched.destination ?? null,
		scheduledDep: sched.scheduled_out ? new Date(sched.scheduled_out) : null,
		scheduledArr: sched.scheduled_in ? new Date(sched.scheduled_in) : null,
		aircraftType: sched.aircraft_type ?? null,
		faFlightId: sched.fa_flight_id ?? null,
	};

	await db.flightStatus.upsert({
		where: { trackedFlightId: flight.id },
		create: { trackedFlightId: flight.id, ...shared },
		update: { lastChecked: new Date(), ...shared },
	});

	await logger.info(
		`Schedule: ${shared.departureAirport ?? '?'} → ${shared.arrivalAirport ?? '?'}`,
		flight.flightId,
	);
}