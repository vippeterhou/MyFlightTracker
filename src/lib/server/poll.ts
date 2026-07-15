import type { Prisma } from '@prisma/client';
import { db } from './db';
import { getFlightByIdent, getFlightSchedule, getFlightTrack, mapAeroStatus } from './aeroapi';
import type { AeroFlight } from './aeroapi';
import { lookupAirportTz } from './airportTz';
import { logger } from './logger';

// AeroAPI's live /flights/{ident} endpoint only accepts query windows ending within ~2 days.
// For flights whose day ends beyond that, the live call 400s, so go straight to schedules.
const LIVE_DATA_WINDOW_DAYS = 2;

export async function pollOneFlight(id: string): Promise<void> {
	const flight = await db.trackedFlight.findUnique({
		where: { id },
		include: { status: true },
	});
	if (!flight) return;

	// getFlightByIdent queries the entire flight day (…T23:59:59Z). AeroAPI's live endpoint
	// rejects (400) windows whose end is more than LIVE_DATA_WINDOW_DAYS out, so measure to
	// the END of the flight day and route to published schedules before the live call fails.
	const endOfFlightDay = flight.date.getTime() + 86400000;
	const daysUntil = (endOfFlightDay - Date.now()) / 86400000;
	if (daysUntil > LIVE_DATA_WINDOW_DAYS) {
		await applyScheduleFallback(flight);
		return;
	}

	// Within the live window: try the live endpoint, but fall back to schedules on any
	// failure (empty result or error) so we still populate the route.
	let aero: AeroFlight | null = null;
	try {
		aero = await getFlightByIdent(flight.flightId, flight.date);
	} catch (err) {
		await logger.warn(
			`Live lookup failed (${(err as Error).message}); falling back to schedule`,
			flight.flightId,
		);
	}
	if (!aero) {
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

type FlightWithStatus = Prisma.TrackedFlightGetPayload<{ include: { status: true } }>;

// Populates route (airport codes) and scheduled times from published schedules for
// flights AeroAPI's live endpoint doesn't cover yet. Skips if the route is already
// known, so it runs at most once per flight and never overwrites live data.
async function applyScheduleFallback(flight: FlightWithStatus): Promise<void> {
	if (flight.status?.departureAirport) return;

	const sched = await getFlightSchedule(flight.flightId, flight.date);
	if (!sched) return;

	const departureAirport = sched.origin_iata ?? sched.origin ?? null;
	const arrivalAirport = sched.destination_iata ?? sched.destination ?? null;

	const shared = {
		status: 'scheduled',
		departureAirport,
		arrivalAirport,
		// Schedules omit timezones, so resolve them from the bundled IATA→IANA dataset
		// so cards can show true airport-local (DST-aware) times instead of UTC.
		departureTz: lookupAirportTz(sched.origin_iata ?? sched.origin),
		arrivalTz: lookupAirportTz(sched.destination_iata ?? sched.destination),
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