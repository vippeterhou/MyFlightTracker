import type { Prisma } from '@prisma/client';
import { db } from './db';
import {
	getFlightByIdent,
	getFlightSchedule,
	getFlightSchedules,
	getFlightsByIdent,
	getFlightTrack,
	mapAeroStatus,
} from './aeroapi';
import type { AeroFlight, AeroSchedule, FlightSelection } from './aeroapi';
import { lookupAirportTz } from './airportTz';
import { logger } from './logger';

// AeroAPI's live /flights/{ident} endpoint only accepts query windows ending within ~2 days.
// For flights whose day ends beyond that, the live call 400s, so go straight to schedules.
const LIVE_DATA_WINDOW_DAYS = 2;

export interface InitialFlightCandidate {
	id: string;
	departureAirport: string | null;
	arrivalAirport: string | null;
	scheduledDep: string | null;
	scheduledArr: string | null;
	departureTz: string | null;
	arrivalTz: string | null;
}

export type InitialFlightMatch =
	| { candidate: InitialFlightCandidate; aero: AeroFlight }
	| { candidate: InitialFlightCandidate; schedule: AeroSchedule };

type FlightWithStatus = Prisma.TrackedFlightGetPayload<{ include: { status: true } }>;

function isBeyondLiveWindow(date: Date): boolean {
	const endOfFlightDay = date.getTime() + 86400000;
	return (endOfFlightDay - Date.now()) / 86400000 > LIVE_DATA_WINDOW_DAYS;
}

function flightSelection(flight: FlightWithStatus): FlightSelection {
	return {
		faFlightId: flight.status?.faFlightId,
		departureAirport: flight.status?.departureAirport,
		arrivalAirport: flight.status?.arrivalAirport,
		scheduledDep: flight.status?.scheduledDep,
	};
}

function liveCandidate(aero: AeroFlight): InitialFlightMatch {
	return {
		candidate: {
			id: `live:${aero.fa_flight_id}`,
			departureAirport: aero.origin?.code_iata ?? null,
			arrivalAirport: aero.destination?.code_iata ?? null,
			scheduledDep: aero.scheduled_out,
			scheduledArr: aero.scheduled_in,
			departureTz: aero.origin?.timezone ?? null,
			arrivalTz: aero.destination?.timezone ?? null,
		},
		aero,
	};
}

function scheduleCandidate(schedule: AeroSchedule): InitialFlightMatch {
	const departureAirport = schedule.origin_iata ?? schedule.origin ?? null;
	const arrivalAirport = schedule.destination_iata ?? schedule.destination ?? null;
	return {
		candidate: {
			id: `schedule:${departureAirport ?? ''}|${arrivalAirport ?? ''}|${schedule.scheduled_out ?? ''}`,
			departureAirport,
			arrivalAirport,
			scheduledDep: schedule.scheduled_out,
			scheduledArr: schedule.scheduled_in,
			departureTz: lookupAirportTz(departureAirport),
			arrivalTz: lookupAirportTz(arrivalAirport),
		},
		schedule,
	};
}

export async function findInitialFlightMatches(
	flightId: string,
	date: Date,
): Promise<InitialFlightMatch[]> {
	const wantedDay = date.toISOString().split('T')[0];

	if (!isBeyondLiveWindow(date)) {
		try {
			const flights = await getFlightsByIdent(flightId, date);
			const localDateMatches = flights.filter((flight) => {
				if (!flight.scheduled_out) return false;
				const tz = flight.origin?.timezone ?? 'UTC';
				return (
					new Date(flight.scheduled_out).toLocaleDateString('en-CA', { timeZone: tz }) ===
					wantedDay
				);
			});
			localDateMatches.sort((a, b) => {
				const aTime = a.scheduled_out ? new Date(a.scheduled_out).getTime() : 0;
				const bTime = b.scheduled_out ? new Date(b.scheduled_out).getTime() : 0;
				return aTime - bTime;
			});
			if (localDateMatches.length > 0) return localDateMatches.map(liveCandidate);
		} catch (err) {
			await logger.warn(
				`Live lookup failed (${(err as Error).message}); falling back to schedule`,
				flightId,
			);
		}
	}

	const schedules = await getFlightSchedules(flightId, date);
	return schedules.map(scheduleCandidate);
}

export async function applyInitialFlightMatch(
	id: string,
	match: InitialFlightMatch,
): Promise<void> {
	const flight = await db.trackedFlight.findUnique({
		where: { id },
		include: { status: true },
	});
	if (!flight) return;

	if ('aero' in match) {
		await applyAeroFlight(flight, match.aero);
	} else {
		await applyScheduleFlight(flight, match.schedule);
	}
}

export async function pollOneFlight(id: string): Promise<void> {
	const flight = await db.trackedFlight.findUnique({
		where: { id },
		include: { status: true },
	});
	if (!flight) return;

	if (isBeyondLiveWindow(flight.date)) {
		await applyScheduleFallback(flight);
		return;
	}

	// Within the live window: try the live endpoint, but fall back to schedules on any
	// failure (empty result or error) so we still populate the route.
	let aero: AeroFlight | null = null;
	try {
		aero = await getFlightByIdent(flight.flightId, flight.date, flightSelection(flight));
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

	await applyAeroFlight(flight, aero);
}

async function applyAeroFlight(flight: FlightWithStatus, aero: AeroFlight): Promise<void> {
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

// Populates route (airport codes) and scheduled times from published schedules for
// flights AeroAPI's live endpoint doesn't cover yet. Skips if the route is already
// known, so it runs at most once per flight and never overwrites live data.
async function applyScheduleFallback(flight: FlightWithStatus): Promise<void> {
	if (flight.status?.departureAirport) return;

	const sched = await getFlightSchedule(
		flight.flightId,
		flight.date,
		flightSelection(flight),
	);
	if (!sched) return;

	await applyScheduleFlight(flight, sched);
}

async function applyScheduleFlight(
	flight: FlightWithStatus,
	sched: AeroSchedule,
): Promise<void> {
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